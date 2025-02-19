export const submitForReview = async (fastify) => {
  if (process.env.RENDER_EXTERNAL_URL) {
    if (!process.env.API_KEY) {
      fastify.log.error(
        'API_KEY is not set. Please set it as an environment variable on render.com to submit your API for review.'
      )
      return
    }

    try {
      const response = await fetch('https://hugogresse.fr/miashs-exam/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: JSON.stringify({
          apiUrl: process.env.RENDER_EXTERNAL_URL,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        fastify.log.info('API submitted for review:', data.reviewUrl)
      } else {
        throw new Error(data.message)
      }
    } catch (error) {
      fastify.log.error('Error while submitting your API for review:', error.message)
    }
  }
}
