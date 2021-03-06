var pkg = require('./package.json');
var cp = require('child_process');
var path = require('path');

module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-download-electron');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-sync');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-msbuild');
    grunt.loadNpmTasks('grunt-chmod');
    grunt.loadNpmTasks('grunt-appdmg');
    
    grunt.loadTasks('./tools/grunt-tasks');

    var defaultTasks = [];
    defaultTasks.push('download-electron');
    if (process.platform === 'win32') {
        defaultTasks.push('msbuild:ieaddon');
    }
    //defaultTasks.push('eslint');
    defaultTasks.push('rebrand');
    defaultTasks.push('module-cleanup');
    // NOTE: sync:main config is automatically updated by modclean task
    defaultTasks.push('sync:main');
    if (process.platform === 'linux') {
        defaultTasks.push('sync:linux');
        // temporary fix before Grunt v0.5 https://github.com/gruntjs/grunt/issues/615
        defaultTasks.push('chmod');
    } else if (process.platform === 'darwin') {
        defaultTasks.push('sync:osx');
        // temporary fix before Grunt v0.5 https://github.com/gruntjs/grunt/issues/615
        defaultTasks.push('chmod');
    } else if (process.platform === 'win32') {
        defaultTasks.push('sync:windows');
    }
    defaultTasks.push('config-patch');

    grunt.registerTask('default', defaultTasks);
    
    if (process.platform === 'linux') {
        grunt.registerTask('dist', ['default', 'compress:linux']);
    } else if (process.platform === 'win32') {
        grunt.registerTask('dist', ['default', 'installer-win']);
    } else if (process.platform === 'darwin') {
        grunt.registerTask('dist', ['default', 'appdmg']);
    }

    const OUTDIR = 'build';
    const RESOURCES = process.platform === 'darwin' ? '/Oxygen.app/Contents/Resources' : '/resources';
                        
    var arch = grunt.option('arch') || 'x64';
    if (arch !== 'x64' && arch !== 'ia32') {
        grunt.fail.fatal('Invalid architecture specified. Allowed architectures: x64 and ia32');
    }
    
    // get production dependencies
    var prodDeps = [];
    try {
        var out = cp.execSync('npm ls --prod=true --parseable');
        var prodDepsUnfiltered = out.toString().split(/\r?\n/);
        var si = __dirname.length + 1 + 'node_modules'.length + 1;
        for (var i = 0; i < prodDepsUnfiltered.length; i++) {
            var dep = prodDepsUnfiltered[i].substring(si);
            if (dep === '' || dep.indexOf(path.sep) > 0) {
                continue;
            }
            prodDeps.push(dep + '/**');
        }
    } catch (e) {
        grunt.fail.fatal('Unable to get production dependencies list', e);
    }

    grunt.initConfig({
        'download-electron': {
            version: '1.4.15',
            arch: arch,
            outputDir: OUTDIR,
            rebuild: false
        },
        rebrand: {
            name: pkg.name,
            version: pkg.version,
            dist: OUTDIR,
        },
        'config-patch': {
            dist: OUTDIR
        },
        clean: 
            [OUTDIR],
        sync: {
            main: {
                files: [
                    { 
                        expand: true, 
                        cwd: 'src', src: ['**', '!config/**'], 
                        dest: OUTDIR + RESOURCES + '/app' 
                    },
                    { 
                        expand: true, 
                        cwd: 'node_modules', src: prodDeps.concat(['!fibers/src/**',
                                                                   '!oxygen-cli/dotnet/**',
                                                                   '!oxygen-cli/lib/reporters/pdf/**',
                                                                   '!oxygen-cli/lib/reporters/html/**',
                                                                   '!*/node_modules/rx/ts/**',
                                                                   '!*/node_modules/nan/**']),
                        dest: OUTDIR + RESOURCES + '/app/node_modules' 
                    },
                    { 
                        expand: true, 
                        src: ['package.json', 'LICENSE'], 
                        dest: OUTDIR + RESOURCES + '/app' 
                    },
                ]
            },
            linux: {
                files: [
                    { 
                        expand: true, 
                        cwd: 'resources', src: ['app.png'], 
                        dest: OUTDIR + RESOURCES + '/app'
                    },
                    { 
                        expand: true, 
                        cwd: 'selenium', src: ['*.jar'], 
                        dest: OUTDIR + '/selenium'
                    },
                    { 
                        expand: true, 
                        cwd: 'selenium/lin', src: ['chromedriver'], 
                        dest: OUTDIR + '/selenium'
                    },
                    { 
                        expand: true, 
                        cwd: 'src', src: ['config/**'], 
                        dest: OUTDIR
                    }
                ]
            },
            osx: {
                files: [
                    { 
                        expand: true, 
                        cwd: 'resources', src: ['app.icns'], 
                        dest: OUTDIR + RESOURCES
                    },
                    { 
                        expand: true, 
                        cwd: 'selenium', src: ['*.jar'], 
                        dest: OUTDIR + RESOURCES + '/../selenium'
                    },
                    { 
                        expand: true, 
                        cwd: 'selenium/osx', src: ['chromedriver'], 
                        dest: OUTDIR + RESOURCES + '/../selenium'
                    },
                    { 
                        expand: true, 
                        cwd: 'src/config', src: ['default.json'], 
                        dest: OUTDIR + RESOURCES + '/../config'
                    },
                    { 
                        expand: true, 
                        cwd: 'src/recorder', src: ['CARoot.cer'], 
                        dest: OUTDIR + RESOURCES + '/../..'
                    },
                ]
            },
            windows: {
                files: [
                    { 
                        expand: true, 
                        cwd: 'selenium', src: ['*.jar'], 
                        dest: OUTDIR + '/selenium'
                    },
                    { 
                        expand: true, 
                        cwd: 'selenium/win', src: ['*.exe'], 
                        dest: OUTDIR + '/selenium'
                    },
                    { 
                        expand: true, 
                        cwd: 'src/recorder', src: ['CARoot.cer'], 
                        dest: OUTDIR
                    },
                    { 
                        expand: true, 
                        cwd: 'browser-extensions/ie/bin/Release', src: ['IEAddon.dll'], 
                        dest: OUTDIR
                    },
                    { 
                        expand: true, 
                        cwd: 'src', src: ['config/**'], 
                        dest: OUTDIR
                    }
                ]
            }
        },
        chmod: {
            options: {
                mode: '775'
            }, 
            'xdg-open': {
                src: [OUTDIR + RESOURCES + '/app/node_modules/opn/xdg-open' ]
            },
            chromedriver: {
                src: [process.platform === 'linux' ? 
                        OUTDIR + '/selenium/chromedriver' :
                        OUTDIR + RESOURCES + '/../selenium/chromedriver']
            }
        },
        compress: {
            linux: {
                options: {
                    archive: 'dist/oxygen-' + pkg.version + '-linux-x64.zip',
                    level: 9
                },
                files: [
                    { 
                        expand: true, 
                        cwd: OUTDIR, src: ['**'], 
                        dest: 'oxygen-' + pkg.version + '-linux-x64'
                    },
                    { 
                        expand: true, 
                        cwd: OUTDIR + '/resources/app/recorder', src: ['CARoot.pem'], 
                        dest: 'oxygen-' + pkg.version + '-linux-x64'
                    }
                ]
            }
        },
        appdmg: {
            options: {
                title: 'Oxygen IDE ' + pkg.version,
                icon: 'resources/app.icns',
                background: 'resources/dmg-background.png',
                window: { size: { width: 627, height: 440 }},
                contents: [
                    {x: 442, y: 210, type: 'link', path: '/Applications'},
                    {x: 186, y: 210, type: 'file', path: path.join(OUTDIR, 'Oxygen.app')},
                ]
            },
            target: {
                dest:  'dist/oxygen-' + pkg.version + '-osx-x64.dmg'
            }
        },
        watch: {
            scripts: {
                files: ['src/**'],
                tasks: ['eslint', 'sync:main', 'sync:linux']
            },
        },
        eslint: {
            target: ['Gruntfile.js', 'src/**/*.js', '!src/ace/**', '!src/recorder/**'],
            options: {
                configFile: 'tools/.eslintrc.json'
            },
        },
        msbuild: {
            ieaddon: {
                src: ['browser-extensions/ie/IEAddon.csproj'],
                options: {
                    projectConfiguration: 'Release',
                    targets: ['Clean', 'Rebuild'],
                    maxCpuCount: 4,
                    buildParameters: {
                        WarningLevel: 2
                    },
                    verbosity: 'minimal'
                }
            }
        },
        'installer-win': {
            version: pkg.version,
            arch: arch
        }
    });
};
