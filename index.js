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

  const sshUrl = payload.repository.ssh_url;
  const httpsUrl = payload.repository.clone_url;
  const dirName = payload.repository.full_name.replace('/', '_');
  const clear = (cmd) => {
    return cmd.replace('%repo', sshUrl).replace('%repo', httpsUrl).replace('%dir', dirName);
  };

  function cloneResultHandler(error, stdout, stderr) {
    if (error) {
      console.error('Could not execute clone command.');
      console.error(error.message.replace(clear(CLONE_COMMAND), '{{CLONE COMMAND}}'));
      return;
    }
    if (stderr) {
      console.error(stderr);
    }
    console.log(stdout);
    console.log('Done!');
  }

  rimraf(path.join(BASE_DIR, dirName), (err) => {
    if (err) {
      console.error('failed to clean directory');
      console.error(err);
    }
    exec(clear(CLONE_COMMAND), (error, stdout, stderr) => {
      // ssh failed? retry with https
      if (error && error.message.match(/ERROR: Repository not found./g)) {
        console.log('retrying with https');
        exec(CLONE_COMMAND.replace('%repo', httpsUrl).replace('%dir', dirName), cloneResultHandler);
        return;
      }
      cloneResultHandler(error, stdout, stderr);
    });
  });
});

app.use(webhooks.middleware);

app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});
