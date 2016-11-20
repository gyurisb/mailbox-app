var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var del = require('del');
var file = require('gulp-file');
var sourcemaps = require('gulp-sourcemaps');
var EmailConnection = require('./src/shared/email/email_conn.js');

gulp.task('clean', function() {
    del(['dist/**/*',   
        '!dist', '!dist/desktop', '!dist/desktop/node_modules/**',
        '!dist/mobile', '!dist/mobile/cordova', '!dist/mobile/cordova/platforms/**', '!dist/mobile/cordova/plugins/**',
        '!dist/mobile/server', '!dist/mobile/server/node_modules/**',
        '!dist/.gitignore'
        ]);
});

gulp.task('clean_full', function() {
    del(['dist/**/*']);
});

gulp.task('build', function() {
    
    gulp.src('src/desktop/**')
        .pipe(gulp.dest('dist/desktop'));
    gulp.src('src/mobile/**')
        .pipe(gulp.dest('dist/mobile'));
    
    gulp.src('src/shared/email/**/*.js')
        .pipe(gulp.dest('dist/desktop/main'))
        .pipe(gulp.dest('dist/mobile/server'));
    gulp.src('src/shared/main/**/*.js')
        .pipe(gulp.dest('dist/desktop/main'))
        .pipe(gulp.dest('dist/mobile/cordova/www/js'));
    gulp.src('src/shared/ui/**/*')
        .pipe(gulp.dest('dist/desktop/renderer'))
        .pipe(file('generated.js', getGeneratedFile()))
        .pipe(gulp.dest('dist/mobile/cordova/www'));

    function getGeneratedFile() {
        var emailActions = Object.keys(new EmailConnection());
        return "var Generated = { emailActions: [" +  emailActions.map(a => '"' + a + '"').join(',') + "] };";
    }
        
    /* source: http://andy-carter.com/blog/a-beginners-guide-to-the-task-runner-gulp */
    // return gulp.src('src/js/*.js')
    //   .pipe(concat('main.js'))
    //     .pipe(rename({suffix: '.min'}))
    //     .pipe(uglify())
    //     .pipe(gulp.dest('build/js'));
});