const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DEFAULT_SNIPPET = '';

module.exports = function withAdiRegistration(config, props = {}) {
  const snippet = props.snippet || DEFAULT_SNIPPET;
  if (!snippet) return config;

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const assetsDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets'
      );
      const registrationFile = path.join(assetsDir, 'adi-registration.properties');

      await fs.promises.mkdir(assetsDir, { recursive: true });
      await fs.promises.writeFile(registrationFile, `${snippet}\n`, 'utf8');

      return config;
    },
  ]);
};
