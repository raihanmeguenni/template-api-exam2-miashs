// src/index.js
import 'dotenv/config';
import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { submitForReview } from './submission.js';

const fastify = Fastify({ logger: true });

// 1) Exposer le JSON OpenAPI sur /json
await fastify.register(fastifySwagger, {
  routePrefix: '/json',
  openapi: {
    info: {
      title: 'API de Villes',
      description: 'API fournissant infos, météo et recettes par ville',
      version: '1.0.0'
    }
  },
  exposeRoute: true
});

// 2) Monter Swagger UI à la racine, pointant vers /json
await fastify.register(fastifySwaggerUi, {
  routePrefix: '/',
  swagger: { url: '/json' },
  uiConfig: { docExpansion: 'full', deepLinking: false }
});

// Configuration externe
const API_BASE_URL = 'https://api-ugi2pflmha-ew.a.run.app';
const API_KEY      = process.env.API_KEY;

// Mémoire pour les recettes
const recipesByCity = {};
let nextRecipeId = 1;

// Schémas pour Swagger
const cityParamSchema = {
  type: 'object',
  properties: { cityId: { type: 'string' } },
  required: ['cityId']
};
const recipeBodySchema = {
  type: 'object',
  properties: {
    content: {
      type: 'string',
      minLength: 10,
      maxLength: 2000
    }
  },
  required: ['content']
};

// GET /cities/:cityId/infos
fastify.get('/cities/:cityId/infos', {
  schema: {
    summary: "Récupère les infos d'une ville",
    tags: ['Cities'],
    params: cityParamSchema,
    response: {
      200: {
        type: 'object',
        properties: {
          coordinates: {
            type: 'array',
            items: { type: 'number' }
          },
          population: { type: 'number' },
          knownFor: {
            type: 'array',
            items: { type: 'string' }
          },
          weatherPredictions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                when: { type: 'string' },
                min: { type: 'number' },
                max: { type: 'number' }
              }
            },
            minItems: 2,
            maxItems: 2
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
      },
      404: { type: 'object', properties: { error: { type: 'string' } } },
      500: { type: 'object', properties: { error: { type: 'string' } } }
    }
  }
}, async (request, reply) => {
  const { cityId } = request.params;
  try {
    // 1) Ville existante ?
    const citiesRes = await fetch(`${API_BASE_URL}/cities?apiKey=${API_KEY}`);
    if (!citiesRes.ok) return reply.code(500).send({ error: 'Erreur API villes' });
    const cities = await citiesRes.json();
    if (!cities.some(c => c.id === cityId)) {
      return reply.code(404).send({ error: 'Ville non trouvée' });
    }

    // 2) Détails ville
    const infoRes = await fetch(
      `${API_BASE_URL}/cities/${cityId}/insights?apiKey=${API_KEY}`
    );
    if (!infoRes.ok) return reply.code(500).send({ error: 'Erreur récupération infos' });
    const cityInfo = await infoRes.json();

    // 3) Prévisions météo
    const weatherRes = await fetch(`${API_BASE_URL}/weather-predictions?apiKey=${API_KEY}`);
    if (!weatherRes.ok) return reply.code(500).send({ error: 'Erreur météo' });
    const allWeather = await weatherRes.json();
    const cityWeather = allWeather.find(w => w.cityId === cityId);
    if (!cityWeather) {
      return reply.code(500).send({ error: 'Prédictions météo manquantes' });
    }
    const findPred = when => cityWeather.predictions.find(p => p.when === when) || {};
    const wpToday    = findPred('today');
    const wpTomorrow = findPred('tomorrow');
    const weatherPredictions = [
      { when: 'today',    min: wpToday.min,    max: wpToday.max    },
      { when: 'tomorrow', min: wpTomorrow.min, max: wpTomorrow.max }
    ];

    // 4) Recettes en mémoire
    const recipes = recipesByCity[cityId] || [];

    // 5) OK !
    return reply.send({
      coordinates: [
        cityInfo.coordinates.latitude,
        cityInfo.coordinates.longitude
      ],
      population: cityInfo.population,
      knownFor: cityInfo.knownFor.map(k => k.content),
      weatherPredictions,
      recipes
    });
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Erreur interne' });
  }
});

// POST /cities/:cityId/recipes
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
      },
      400: { type: 'object', properties: { error: { type: 'string' } } },
      404: { type: 'object', properties: { error: { type: 'string' } } }
    }
  }
}, async (request, reply) => {
  const { cityId } = request.params;
  const { content } = request.body;
  try {
    // Ville existante ?
    const cities = await (await fetch(`${API_BASE_URL}/cities?apiKey=${API_KEY}`)).json();
    if (!cities.some(c => c.id === cityId)) {
      return reply.code(404).send({ error: 'Ville non trouvée' });
    }
    // Validation
    if (!content)            return reply.code(400).send({ error: 'Contenu requis' });
    if (content.length < 10) return reply.code(400).send({ error: 'Trop court (<10)' });
    if (content.length > 2000) return reply.code(400).send({ error: 'Trop long (>2000)' });

    const recipe = { id: nextRecipeId++, content };
    recipesByCity[cityId] = recipesByCity[cityId] || [];
    recipesByCity[cityId].push(recipe);

    return reply.code(201).send(recipe);
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Erreur interne' });
  }
});

// DELETE /cities/:cityId/recipes/:recipeId
fastify.delete('/cities/:cityId/recipes/:recipeId', {
  schema: {
    summary: "Supprime une recette",
    tags: ['Recipes'],
    params: {
      type: 'object',
      properties: {
        cityId:   { type: 'string' },
        recipeId: { type: 'string' }
      },
      required: ['cityId','recipeId']
    },
    response: {
      204: { type: 'null' },
      404: { type: 'object', properties: { error: { type: 'string' } } }
    }
  }
}, async (request, reply) => {
  const { cityId, recipeId } = request.params;
  try {
    // Ville existante ?
    const cities = await (await fetch(`${API_BASE_URL}/cities?apiKey=${API_KEY}`)).json();
    if (!cities.some(c => c.id === cityId)) {
      return reply.code(404).send({ error: 'Ville non trouvée' });
    }
    const rid = parseInt(recipeId, 10);
    if (!recipesByCity[cityId]?.some(r => r.id === rid)) {
      return reply.code(404).send({ error: 'Recette non trouvée' });
    }
    recipesByCity[cityId] = recipesByCity[cityId].filter(r => r.id !== rid);
    return reply.code(204).send();
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Erreur interne' });
  }
});

// Parser JSON pour renvoyer 400 sur JSON invalide
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (req, body, done) => {
    try {
      done(null, body.length ? JSON.parse(body) : {});
    } catch (err) {
      err.statusCode = 400;
      done(err);
    }
  }
);

// Démarrage
fastify.listen(
  {
    port: process.env.PORT || 3000,
    host: process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : (process.env.HOST || 'localhost')
  },
  err => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    submitForReview(fastify);
  }
);
