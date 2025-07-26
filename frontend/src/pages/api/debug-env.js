// Debug endpoint to check environment variables
export default function handler(req, res) {
  res.status(200).json({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
    NODE_ENV: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    message: 'If NEXT_PUBLIC_API_URL is missing or wrong, environment variables are not being applied to this deployment'
  });
}