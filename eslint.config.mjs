import next from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'prisma/migrations/**',
      'uniform-crawler/**',
      'public/**',
    ],
  },
  ...next,
];

export default config;
