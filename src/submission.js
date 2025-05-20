// src/submission.js
export const submitForReview = async (fastify) => {
  if (!process.env.RENDER_EXTERNAL_URL) return;
  if (!process.env.API_KEY) {
    fastify.log.error(
      'API_KEY is not set. Please set it on render.com to enable submission.'
    );
    return;
  }
  try {
    // Laisser le serveur démarrer
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(
      `https://api-ugi2pflmha-ew.a.run.app/group/submissions?apiKey=${process.env.API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          apiUrl: process.env.RENDER_EXTERNAL_URL,
          gitRepo: process.env.RENDER_GIT_REPO_SLUG
        })
      }
    );
    if (res.ok) {
      fastify.log.info('API submitted for review.');
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (err) {
    fastify.log.error('Submission error:', err);
  }
};
