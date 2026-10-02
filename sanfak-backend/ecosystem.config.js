module.exports = {
  apps: [
    {
      name: "institute-ais",
      script: "src/index.js",
      cwd: __dirname,

      instances: 1,
      exec_mode: "fork",

      watch: false,

      max_memory_restart: "512M",

      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 4000,

      output: "./logs/pm2-out.log",
      error: "./logs/pm2-error.log",
      merge_logs: true,
      time: true,

      env: {
        NODE_ENV: "development",
      },

      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
