# Emuflight Configurator

![Emuflight](.github/EmuFlight.png)


Emuflight Configurator is a crossplatform configuration tool for the Emuflight flight control system.

It runs as an app within Google Chrome and allows you to configure the Emuflight software running on any [supported Emuflight target](https://github.com/emuflight/EmuFlight/tree/Main/src/main/target).

There is also now a standalone version available, since Google Chrome Apps are getting deprecated on platforms that aren't Chrome OS. [Downloads are available in Releases.](https://github.com/emuflight/EmuConfigurator/releases)

Various types of aircraft are supported by the tool and by Emuflight, e.g. quadcopters, hexacopters, octocopters and fixed-wing aircraft.

## Authors

Emuflight Configurator is a [fork](#credits) of the Cleanflight Configurator with support for Emuflight instead of Cleanflight.

This configurator is the only configurator with support for Emuflight specific features. It will likely require that you run the latest firmware on the flight controller.
If you are experiencing any problems please make sure you are running the [latest firmware version](https://github.com/emuflight/EmuFlight/releases).

## Installation

### Standalone

[![Build Status](https://travis-ci.org/emuflight/EmuFlight.svg?branch=Main)](https://travis-ci.org/emuflight/EmuFlight)

**This is the default installation method, and at some point in the future this will become the only way available for most platforms. Please use this method whenever possible.**

Download the installer from [Releases.](https://github.com/emuflight/EmuConfigurator/releases)

### Unstable Testing Versions

Not available at this time. 

## Development

### Environment Setup

1. Install node.js
2. Install yarn: `npm install yarn -g`
3. Change to project folder and run `yarn install`.
4. Run `yarn start`.

### Running tests

`yarn test`

### App build and release

The tasks are defined in `gulpfile.js` and can be run with through yarn:
```
yarn gulp <taskname> [[platform] [platform] ...]
```

List of possible values of `<task-name>`:
* **dist** copies all the JS and CSS files in the `./dist` folder.
* **apps** builds the apps in the `./apps` folder [1].
* **debug** builds debug version of the apps in the `./debug` folder [1].
* **release** zips up the apps into individual archives in the `./release` folder [1]. 

[1] Running this task on macOS or Linux requires Wine, since it's needed to set the icon for the Windows app (build for specific platform to avoid errors).

#### Build or release app for one specific platform
To build or release only for one specific platform you can append the plaform after the `task-name`.
If no platform is provided, all the platforms will be done in sequence.

* **MacOS** use `yarn gulp <task-name> --osx64`
* **Linux** use `yarn gulp <task-name> --linux64`
* **Windows** use `yarn gulp <task-name> --win32`
* **ChromeOS** use `yarn gulp <task-name> --chromeos`

You can also use multiple platforms e.g. `yarn gulp <taskname> --osx64 --linux64`.

## Languages

Emuflight Configurator has been translated into several languages. The application will try to detect and use your system language if a translation into this language is available.

If you prefer to have the application in English or any other language, you can select your desired language in the options menu of the application.

## Notes

### WebGL

Make sure Settings -> System -> "User hardware acceleration when available" is checked to achieve the best performance

### Linux users

Dont forget to add your user into dialout group "sudo usermod -aG dialout YOUR_USERNAME" for serial access

### Linux / MacOSX users

If you have 3D model animation problems, enable "Override software rendering list" in Chrome flags chrome://flags/#ignore-gpu-blacklist

## Support

If you need help please reach out in [Emuflight support group](https://discordapp.com/channels/547211754845765635/596913667447062547) in Discord before raising issues on Github. Register and [join via this link](https://discord.gg/TM5hpcM).

### Issue trackers

For Emuflight configurator issues raise them here

https://github.com/emuflight/EmuConfigurator/issues

For Emuflight firmware issues raise them here

https://github.com/emuflight/EmuFlight/issues

## Technical details

The configurator is based on chrome.serial API running on Google Chrome/Chromium core.

## Developers

We accept clean and reasonable patches, submit them!

## Credits

ctn - primary author and maintainer of Baseflight Configurator from which Cleanflight Configurator project was forked.

Hydra -  author and maintainer of Cleanflight Configurator from which this project was forked.

"# EmuConfigurator" 
