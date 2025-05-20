import 'dotenv/config';
import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { submitForReview } from './submission.js';

async function main() {
  const fastify = Fastify({ logger: true });

  // Configuration Swagger
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'API de Villes',
        description: 'API fournissant infos, météo et recettes par ville',
        version: '1.0.0'
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Serveur local' }
      ]
    },
    exposeRoute: true
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    }
  });

  // Configuration de l'API externe
  const API_BASE_URL = 'https://api-ugi2pflmha-ew.a.run.app';
  const API_KEY = process.env.API_KEY;
  console.log(`API_KEY configurée: ${API_KEY}`);

  // Stockage en mémoire pour les recettes
  const recipesByCity = {};
  let nextRecipeId = 1;

  // Schémas JSON pour Swagger
  const cityParamSchema = {
    type: 'object',
    properties: {
      cityId: { type: 'string', description: "Identifiant de la ville" }
    },
    required: ['cityId']
  };
  const recipeBodySchema = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        minLength: 10,
        maxLength: 2000,
        description: 'Contenu de la recette'
      }
    },
    required: ['content']
  };

  // Route GET /cities/:cityId/infos
  fastify.get('/cities/:cityId/infos', {
    schema: {
      summary: "Récupère les informations d'une ville",
      description: "Retourne coordonnées, population, points d'intérêt, météo et recettes",
      tags: ['Cities'],
      params: cityParamSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            coordinates: {
              type: 'array',
              items: { type: 'number' },
              description: 'Latitude et longitude'
            },
            population: { type: 'number' },
            knownFor: { type: 'array', items: { type: 'string' } },
            weatherPredictions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  when: { type: 'string' },
                  min: { type: 'number' },
                  max: { type: 'number' }
                }
              }
            },
            recipes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  content: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { cityId } = request.params;
    try {
      // Vérification existence de la ville
      const citiesResponse = await fetch(`${API_BASE_URL}/cities?apiKey=${API_KEY}`);
      if (!citiesResponse.ok) return reply.code(500).send({ error: 'Erreur vérification ville' });
      const cities = await citiesResponse.json();
      if (!cities.some(c => c.id === cityId)) return reply.code(404).send({ error: 'Ville non trouvée' });

      // Récupération des détails de la ville
      const cityInfoResponse = await fetch(`${API_BASE_URL}/cities/${cityId}/insights?apiKey=${API_KEY}`);
      if (!cityInfoResponse.ok) return reply.code(500).send({ error: 'Erreur récupération infos ville' });
      const cityInfo = await cityInfoResponse.json();

      // Récupération des prévisions météo
      const weatherResponse = await fetch(`${API_BASE_URL}/weather-predictions?apiKey=${API_KEY}`);
      if (!weatherResponse.ok) return reply.code(500).send({ error: 'Erreur météo' });
      const allWeatherData = await weatherResponse.json();
      const cityWeather = allWeatherData.find(item => item.cityId === cityId);
      if (!cityWeather) return reply.code(500).send({ error: 'Météo indisponible' });
      const weatherPredictions = cityWeather.predictions.map(p => ({
        when: p.when,
        min: p.min,
        max: p.max
      }));

      // Recettes en mémoire
      const recipes = recipesByCity[cityId] || [];

      // Transformation coordonnées
      const coordinates = [
        cityInfo.coordinates.latitude,
        cityInfo.coordinates.longitude
      ];

      return reply.send({
        coordinates,
        population: cityInfo.population,
        knownFor: cityInfo.knownFor,
        weatherPredictions,
        recipes
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Erreur interne' });
    }
  });

  // Route POST /cities/:cityId/recipes
  fastify.post('/cities/:cityId/recipes', {
    schema: {
      summary: "Ajoute une recette à une ville",
      tags: ['Recipes'],
      params: cityParamSchema,
      body: recipeBodySchema,
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            content: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { cityId } = request.params;
    const { content } = request.body;
    try {
      // Vérification existence de la ville
      const cities = await (await fetch(`${API_BASE_URL}/cities?apiKey=${API_KEY}`)).json();
      if (!cities.some(c => c.id === cityId)) return reply.code(404).send({ error: 'Ville non trouvée' });

      // Validation du contenu
      if (!content) return reply.code(400).send({ error: 'Le contenu est requis' });
      if (content.length < 10) return reply.code(400).send({ error: 'Le contenu est trop court' });
      if (content.length > 2000) return reply.code(400).send({ error: 'Le contenu est trop long' });

      // Ajout de la recette
      if (!recipesByCity[cityId]) recipesByCity[cityId] = [];
      const recipe = { id: nextRecipeId++, content };
      recipesByCity[cityId].push(recipe);

      return reply.code(201).send(recipe);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Erreur interne' });
    }
  });

  // Route DELETE /cities/:cityId/recipes/:recipeId
  fastify.delete('/cities/:cityId/recipes/:recipeId', {
    schema: {
      summary: "Supprime une recette",
      tags: ['Recipes'],
      params: {
        type: 'object',
        properties: {
          cityId: { type: 'string' },
          recipeId: { type: 'string' }
        },
        required: ['cityId', 'recipeId']
      },
      response: {
        204: { type: 'null' }
      }
    }
  }, async (request, reply) => {
    const { cityId, recipeId } = request.params;
    try {
      // Vérification existence de la ville
      const cities = await (await fetch(`${API_BASE_URL}/cities?apiKey=${API_KEY}`)).json();
      if (!cities.some(c => c.id === cityId)) return reply.code(404).send({ error: 'Ville non trouvée' });

      // Suppression de la recette
      const rid = parseInt(recipeId, 10);
      if (!recipesByCity[cityId]?.some(r => r.id === rid)) return reply.code(404).send({ error: 'Recette non trouvée' });

      recipesByCity[cityId] = recipesByCity[cityId].filter(r => r.id !== rid);
      return reply.code(204).send();
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Erreur interne' });
    }
  });

  // JSON parser middleware
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = body.length > 0 ? JSON.parse(body) : {};
      done(null, json);
    } catch (error) {
      error.statusCode = 400;
      done(error, undefined);
    }
  });

  const port = process.env.PORT || 3000;
  const host = process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : process.env.HOST || 'localhost';
  await fastify.listen({ port, host });
  console.log(`Serveur démarré sur le port ${port}`);
  submitForReview(fastify);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
