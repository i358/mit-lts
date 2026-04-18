import axios from 'axios';

export async function postDiscordWebhookMessage(webhookUrl: string, content: string) {
  if (!webhookUrl) {
    throw new Error('webhookUrl is required');
  }

  await axios.post(
    webhookUrl,
    { content },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}
