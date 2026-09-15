const { execSync } = require('child_process');

if (process.env.OPEN_NEXT_BUILD) {
  // Inside OpenNext compilation: execute standard Next.js build
  execSync('next build', { stdio: 'inherit' });
} else {
  // CI/CD or direct entrypoint: execute OpenNext Cloudflare builder
  process.env.OPEN_NEXT_BUILD = 'true';
  execSync('npx @opennextjs/cloudflare build', { stdio: 'inherit' });
}
