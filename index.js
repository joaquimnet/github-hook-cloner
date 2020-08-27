require('tiny-env')('../.env');
const express = require('express');
const rimraf = require('rimraf');
const { Webhooks } = require('@octokit/webhooks');
const { exec } = require('child_process');
const path = require('path');

const { CLONE_COMMAND, BASE_DIR, GITHUB_HOOK_SECRET, PORT } = process.env;

const webhooks = new Webhooks({
  secret: GITHUB_HOOK_SECRET,
  path: '/push',
});

const app = express();

app.use(express.json());

webhooks.on('*', async ({ id, name, payload }) => {
  console.log(name, 'event received for repo', payload.repository.full_name);
  if (name !== 'push') return;

  const repoUrl = payload.repository.ssh_url;
  const dirName = payload.repository.full_name.replace('/', '_');
  const cloneCmd = CLONE_COMMAND.replace('%repo', repoUrl).replace('%dir', dirName);

  rimraf(path.join(BASE_DIR, dirName));

  exec(cloneCmd, (error, stdout, stderr) => {
    if (error) {
      console.error('Could not execute clone command.');
      console.error(error.message);
      return;
    }
    if (stderr) {
      console.error('stderr output:');
      console.error(stderr);
      return;
    }
    console.log(stdout);
    console.log('Done!');
  });
});

app.use(webhooks.middleware);

app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});
