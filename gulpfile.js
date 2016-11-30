var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var ignore = require('gulp-ignore');
var del = require('del');
var file = require('gulp-file');
var sourcemaps = require('gulp-sourcemaps');
var install = require('gulp-install');
var shell = require('gulp-shell');
var flattenPackages = require('flatten-packages');
var electronPackager = require('electron-packager');
var electronInstaller = require('electron-winstaller');
var fs = require('fs');
var EmailConnection = require('./src/shared/email/email_conn.js');

gulp.task('clean_source', function() {
    return del(['dist/**'].concat(delExcept([
        'dist/bin/**',
        'dist/desktop/node_modules/**',
        'dist/desktop/renderer/node_modules/**', 
        'dist/mobile/cordova/plugins/**', 
        'dist/mobile/cordova/platforms/**',
        'dist/mobile/cordova/www/node_modules/**',
        'dist/mobile/server/node_modules/**',
        'dist/desktop/mailbox.db'
    ])));
});

gulp.task('build_source_desktop', ['clean_source'], function(){
    return gulp.src('src/desktop/**')
        .pipe(gulp.dest('dist/desktop'));
})
gulp.task('build_source_mobile', ['clean_source'], function(){
    return gulp.src('src/mobile/**')
        .pipe(gulp.dest('dist/mobile'));
})
gulp.task('build_source_email', ['clean_source'], function(){
    return gulp.src('src/shared/email/**/*.js')
        .pipe(gulp.dest('dist/desktop/main'))
        .pipe(gulp.dest('dist/mobile/server'));
})
gulp.task('build_source_main', ['clean_source'], function(){
    return gulp.src('src/shared/main/**/*.js')
        .pipe(gulp.dest('dist/desktop/main'))
        .pipe(gulp.dest('dist/mobile/cordova/www/js'));
})
gulp.task('build_source_ui', ['clean_source'], function(){
    return gulp.src('src/shared/ui/**/*')
        .pipe(gulp.dest('dist/desktop/renderer'))
        .pipe(file('generated.js', getGeneratedFile()))
        .pipe(gulp.dest('dist/mobile/cordova/www'));
    function getGeneratedFile() {
        var emailActions = Object.keys(new EmailConnection());
        return "var Generated = { emailActions: [" +  emailActions.map(a => '"' + a + '"').join(',') + "] };";
    }
})
gulp.task('build_source', ['build_source_desktop', 'build_source_mobile', 'build_source_email', 'build_source_main', 'build_source_ui'])

gulp.task('install_packages_desktop', ['build_source_desktop'], function(){
    return gulp.src('dist/desktop/package.json')
        .pipe(discardIfExists('dist/desktop/node_modules'))
        .pipe(install());
})
gulp.task('install_packages_server', ['build_source_mobile'], function(){
    return gulp.src('dist/mobile/server/package.json')
        .pipe(discardIfExists('dist/mobile/server/node_modules'))
        .pipe(install());
})
gulp.task('install_packages_desktop_ui', ['build_source_ui'], function(){
    return gulp.src('dist/desktop/renderer/package.json')
        .pipe(discardIfExists('dist/desktop/renderer/node_modules'))
        .pipe(install());
})
gulp.task('install_packages_mobile_ui', ['build_source_ui'], function(){
    return gulp.src('dist/mobile/cordova/www/package.json')
        .pipe(discardIfExists('dist/mobile/cordova/www/node_modules'))
        .pipe(install());
})
gulp.task('install_packages', ['install_packages_desktop', 'install_packages_desktop_ui', 'install_packages_server', 'install_packages_mobile_ui']);

gulp.task('rebuild_packages_desktop_sqlite3_exec', ['install_packages_desktop'], function(){
    return gulp.src('dist/desktop/node_modules/sqlite3')
        .pipe(discardIfExists('dist/desktop/node_modules/sqlite3/build/release/node_sqlite3.node'))
        .pipe(shell('npm run prepublish', { cwd: '<%= file.path %>' }))
        .pipe(shell('node-gyp configure --module_name=node_sqlite3 --module_path=../lib/binding/node-v46-win32-x64', { cwd: '<%= file.path %>' }))
        .pipe(shell('node-gyp rebuild --target=1.4.10 --arch=x64 --target_platform=win32 --dist-url=https://atom.io/download/atom-shell --module_name=node_sqlite3 --module_path=../lib/binding/node-v46-win32-x64', { cwd: '<%= file.path %>' }))
})
gulp.task('rebuild_packages_desktop_sqlite3', ['rebuild_packages_desktop_sqlite3_exec'], function() {
    return gulp.src('dist/desktop/node_modules/sqlite3/build/release/node_sqlite3.node')
        .pipe(discardIfExists('dist/desktop/node_modules/sqlite3/lib/binding/electron-v1.4-win32-x64'))
        .pipe(gulp.dest('dist/desktop/node_modules/sqlite3/lib/binding/electron-v1.4-win32-x64'));
})
gulp.task('rebuild_packages_desktop', ['rebuild_packages_desktop_sqlite3']);

gulp.task('flatten_packages_desktop', ['rebuild_packages_desktop'], function(done){
    if (!fs.existsSync('dist/desktop/node_modules/nan')) {
        flattenPackages('dist/desktop', {}, function(err, res){
            if (err) done(err);
            else done();
        });
    } else done();
})

gulp.task('minimize_packages_mobile_ui', ['install_packages_mobile_ui'], function(){
    return del(['dist/mobile/cordova/www/node_modules/**'].concat(delExcept([
        'dist/mobile/cordova/www/node_modules/angular/angular.min.js',
        'dist/mobile/cordova/www/node_modules/angular-animate/angular-animate.min.js',
        'dist/mobile/cordova/www/node_modules/angular-aria/angular-aria.min.js',
        'dist/mobile/cordova/www/node_modules/angular-messages/angular-messages.min.js',
        'dist/mobile/cordova/www/node_modules/angular-material/angular-material.min.js',
        'dist/mobile/cordova/www/node_modules/angular-material/angular-material.min.css',
        'dist/mobile/cordova/www/node_modules/angular-ui-tinymce/dist/tinymce.min.js',
        'dist/mobile/cordova/www/node_modules/font-awesome/fonts/**',
        'dist/mobile/cordova/www/node_modules/font-awesome/css/font-awesome.min.css',
        'dist/mobile/cordova/www/node_modules/jquery/dist/jquery.min.js',
        'dist/mobile/cordova/www/node_modules/tinymce/**',
    ])));
});

gulp.task('prepare_cordova', ['build_source_mobile'], function(){
    return gulp.src('dist/mobile/cordova')
        .pipe(discardIfExists('dist/mobile/cordova/platforms'))
        .pipe(shell('cordova prepare', { cwd: '<%= file.path %>' }))
});

gulp.task('build', ['build_source', 'prepare_cordova', 'install_packages', 'rebuild_packages_desktop', 'flatten_packages_desktop', 'minimize_packages_mobile_ui']);

gulp.task('make_electron_package', ['build'], function(done){
    electronPackager({
        dir: 'dist/desktop',
        out: 'dist/bin/portable',
        platform: 'win32',
        arch: 'x64'
    }, function(err, appPaths){
        if (err) done(err);
        else done();
    })
});

gulp.task('minimize_electron_package', ['make_electron_package'], function(){
    return del(['dist/bin/portable/MailboxExplorer-win32-x64/resources/app/mailbox.db'])
});

gulp.task('bundle_electron_package', ['make_electron_package', 'minimize_electron_package']);

gulp.task('bundle_windows', ['bundle_electron_package'], function(done){
	electronInstaller.createWindowsInstaller({
		appDirectory: 'dist/bin/portable/MailboxExplorer-win32-x64',
		outputDirectory: 'dist/bin/win32-x64',
		authors: 'Gyuris Bence',
		noMsi: true,
        setupIcon: "dist/desktop/appicon.ico"
	}).then(() => done(), (e) => done(e));
});

gulp.task('cordova_build_wp8', ['build'], function(){
    return gulp.src('dist/mobile/cordova')
        .pipe(shell('cordova build wp8 --release', { cwd: '<%= file.path %>' }))
});

gulp.task('bundle_wp8', ['cordova_build_wp8'], function(){
    return gulp.src('dist/mobile/cordova/platforms/wp8/Bin/Release/CordovaAppProj_Release_AnyCPU.xap')
        .pipe(gulp.dest('dist/bin/wp8'))
});

gulp.task('cordova_build_android', ['build'], function(){
    return gulp.src('dist/mobile/cordova')
        .pipe(shell('cordova build android --release', { cwd: '<%= file.path %>' }))
});

gulp.task('bundle_android', ['cordova_build_android'], function(){
    return gulp.src('dist/mobile/cordova/platforms/android/build/outputs/apk/android-release-unsigned.apk')
        .pipe(gulp.dest('dist/bin/android'))
});

gulp.task('bundle', ['bundle_windows', 'bundle_wp8', 'bundle_android']);

function discardIfExists(path) {
    if (fs.existsSync(path)) {
        return ignore.exclude('**')
    } else {
        return ignore.include('**')
    }
}

function delExcept(folders) {
    var res = {};
    folders.forEach(function(folder){
        var route = folder.split('/');
        route.forEach((e, i) => {
            res['!' + route.slice(0, i + 1).join('/')] = true;
        });
    });
    return Object.keys(res);
}