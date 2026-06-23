module.exports = {
  apps: [
    {
      name: "mandacaruzap-backend",
      cwd: "./backend",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "mandacaruzap-worker",
      cwd: "./worker",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "mandacaruzap-frontend",
      cwd: "./frontend",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
