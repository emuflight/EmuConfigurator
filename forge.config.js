const fs = require('fs');
const path = require('path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const buildMode = process.env.EMUCFG_BUILD_MODE || 'release';

// Handle graceful shutdown in development mode
// When yarn dev receives Ctrl+C, exit cleanly.
// The Electron process will be terminated automatically when this parent exits.
// Avoid using killall/taskkill as they can kill unrelated Electron apps (VSCode, Slack, etc.).
if (process.env.NODE_ENV !== 'production') {
  process.on('SIGINT', () => {
    console.log('[forge.config.js] SIGINT received, exiting gracefully...');
    process.exit(0);
  });
}

module.exports = {
  packagerConfig: {
    asar: true,
    // Platform-specific icons: Electron Forge uses icon for executable, installer, etc.
    icon: (() => {
      switch (process.platform) {
        case 'win32':
          return path.resolve(__dirname, 'assets/windows/emu_installer');
        case 'darwin':
          return path.resolve(__dirname, 'assets/osx/app-icon');
        case 'linux':
          return path.resolve(__dirname, 'assets/linux/icon/emu_icon_128');
        default:
          return path.resolve(__dirname, 'assets/osx/app-icon');
      }
    })(),
    // Specify architecture: defaults to current platform arch, override with EMUCFG_ARCH env var
    // Valid values: x64, ia32 (for Windows), x64, arm64 (for macOS), x64, arm64 (for Linux)
    arch: process.env.EMUCFG_ARCH || undefined,
    // Ensure the binary is named as expected for Linux makers
    executableName: 'emuflight-configurator',
    // macOS signing: ad-hoc by default (works without certs)
    // To use certificate: set APPLE_SIGNING_IDENTITY environment variable
    ...(process.platform === 'darwin' ? {
      osxSign: {
        ...(process.env.APPLE_SIGNING_IDENTITY ? { identity: process.env.APPLE_SIGNING_IDENTITY } : {}),
        hardenedRuntime: true,
        entitlements: path.resolve(__dirname, 'sign/entitlements.plist'),
        entitlementsInherit: path.resolve(__dirname, 'sign/entitlements.plist'),
      },
    } : {}),
  },
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const packageJsonPath = path.join(buildPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      packageJson.buildMode = buildMode;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-wix',
      platforms: ['win32'],
      config: {
        exe: 'emuflight-configurator',
        icon: './assets/windows/emu_installer.ico',
        certificateFile: process.env.WINDOWS_CERT_FILE,
        certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32'],
      // Portable ZIP for all platforms: extract and run, no installer needed.
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          maintainer: 'EmuFlight',
          homepage: 'https://github.com/EmuFlight/EmuConfigurator',
          icon: path.resolve(__dirname, 'assets/linux/icon/emu_icon_128.png'),
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {
        options: {
          homepage: 'https://github.com/EmuFlight/EmuConfigurator',
          icon: path.resolve(__dirname, 'assets/linux/icon/emu_icon_128.png'),
        },
      },
    },
    // DMG maker: Skip in CI (macos-alias native module doesn't build reliably in CI)
    // Users can build DMG locally with: yarn make (macOS only)
    // ZIP is sufficient for distribution on macOS
    ...(!process.env.CI && process.platform === 'darwin' ? [{
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        format: 'UDZO',
        background: path.resolve(__dirname, 'assets/osx/dmg-background.png'),
      },
    }] : []),
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
