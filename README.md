# API – Examen MIASHS 2025 

## Préparation

1. *Forker* le template suivant : https://
2. Copier le fichier .env.example, le renommer .env et renseigner la variable API_KEY avec la clé qui vous a été fournie
3. Installer les dépendances du projet (dans le *repository* précédement *forker*) : `npm install`
4. Lancer le serveur : `npm start`

## Déploiement

1. Connectez-vous sur [render.com](https://dashboard.render.com)
2. Créer un nouveau *Web Service* (bouton “+ New” en haut à droite)
3. Sélectionner le *repository* github correspondant à votre projet
4. Renseigner *Build Command* avec la commande suivante : `npm install`
5. Renseigner *Start Command* avec la commande suivante : `npm start`
6. Sélectionner l’*Instance Type* **Free**
7. Renseigner la variable d'environnement suivante :
   - API_KEY : la clé d'API qui vous a été fournie
   - PORT : `3000`
   - HOST : `0.0.0.0` (votre service ne fonctionnera pas si vous renseignez une autre valeur)
8. Valider la création du service : *Déploy web service*
9. Attendez que render.com déploie votre API, dans les logs, une fois votre serveur démarré, vous devriez voir passer le log suivant : `API submitted for review: [une url sur laquelle vous allez voir le résultat du test de votre API]`

## Implémentation de l’API

Vous devez implémenter 3 routes, pour cela vous allez devoir récupérer des informations disponibles depuis 2 APIs :
- La première API que l'on nommera “City API” vous permettra de récupérer des informations sur des villes.
- La deuxième API que l'on nommera “Weather API” vous permettra de récupérer des prévisions météorologiques.

La documentation de ces APIs est disponible à l'adresse suivante : https://hugogresse.fr/miashs-exam/api

### GET /cities/:cityId/infos

Implémenter une route `GET` avec le `path` suivant : `cities/:cityId/infos`. Le paramètre d'url `:cityId` est un identifiant unique pour chaque ville disponibles depuis *City API*.

Cette route doit permettre de récupérer des informations associées à une ville.

Le format de réponse attendu est le suivant: 

```json
{
  // An array of number where the first item is the latitude and the second the longitude of the city
  coordinates: [lat: number, lon: number],
  // An integer representing the population of the city
  population: integer,
  // An array of strings
  knownFor: string[],
  // An array of 2 objects representing the weather predictions for today and tomorrow
  weatherPredictions: [
    { when: 'today', min: number, max: number },
    { when: 'tomorrow', min: number, max: number }
  ],
  // An array of objects representing recipes added to a particular city, should be an empty array when no recipes has been added yet
  recipes: { id: integer, content: string }[] 
}
```

Toutes les données permettant de générer la réponse sont disponibles depuis *City API* et *Weather API*.

Vous devrez gérer le cas les d’erreurs suivants :
  - Appel de la route avec une ville (`:cityId`) qui n’existe pas (les villes existantes sont fournies par “City API”)

### POST /cities/:cityId/recipes

Implémenter une route `POST` avec le `path` suivant : `/cities/:cityId/recipes`. Le paramètre d’url `:cityId` est un identifiant unique pour chaque ville disponibles depuis *City API*

Cette route doit permettre d’associer une recette de cuisine à une ville. La recette envoyé par le client doit donc être sauvez sur le serveur mais elle doit aussi être associée avec la ville définie par le paramètre d'url `:cityId`.

Le format du contenu de la requête (`body`) est le suivant: 

```json
{
  // A string of text representing the recipe description
  content: string,
}
```

Vous devrez stocker les données en mémoire (dans un variable globale) sur votre serveur et renvoyer la recette créée au client (avec une propriété `id` permettant d’identifier cette recette en particulier).

Le format de réponse attendu est le suivant: 

```json
{
  // An integer representing a unique identifier for this recipe, this id could be used to retrieve and/or delete this recipe
  id: integer,
  // A string of text representing the recipe description as provided by the client in the request body
  content: string
}
```

Vous devrez gérer le cas les d’erreurs suivants :
  - Création d’une recette sur une ville qui n’existe pas (les villes existantes sont fournies par “City API”)
  - Création d’une recette sans contenu (`content` vide)
  - Création d’une recette avec un contenu trop court (inférieur à 10 caractères)
  - Création d’une recette avec un contenu trop long (supérieur à 2000 caractères)

### DELETE /cities/:cityId/recipes/:recipeId

Implémenter une route `DELETE` avec le `path` suivant : `/cities/:cityId/recipes/:recipeId`. Le paramètre d’url `:cityId` est un identifiant unique pour chaque ville disponibles depuis *City API* et le paramètre d’url `:recipeId` est un identifiant unique d'une recette généré au moment de la création de la recette.

Cette route doit permettre de supprimer une recette précédemment créé et associé à une ville.

Gérer le cas les d’erreurs suivants :
  - Suppression d’une recette appartenant à une ville qui n’existe pas (les villes existantes sont fournies par “City API”)
  - Suppression d’une recette qui n’existe pas
