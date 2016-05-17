var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var del = require('del');
//gulp-clean |gulp-del

gulp.task('build', function() {
    
    // del(['dist/**/*',   
    //     '!dist', '!dist/desktop', '!dist/desktop/node_modules/**',
    //     '!dist/mobile', '!dist/mobile/cordova', '!dist/mobile/cordova/platforms/**',
    //     '!dist/mobile/server', '!dist/mobile/server/node_modules/**',
    //     '!dist/.gitignore'
    //     ]);
    
    gulp.src('src/desktop/**')
        .pipe(gulp.dest('dist/desktop'));
    gulp.src('src/mobile/**')
        .pipe(gulp.dest('dist/mobile'));
    
    gulp.src('src/shared/email/*.js')
        .pipe(gulp.dest('dist/desktop/main'))
        .pipe(gulp.dest('dist/mobile/server'));
    gulp.src('src/shared/main/*.js')
        .pipe(gulp.dest('dist/desktop/main'))
        .pipe(gulp.dest('dist/mobile/cordova/www/js'));
    gulp.src('src/shared/ui/**/*')
        .pipe(gulp.dest('dist/desktop/renderer'))
        .pipe(gulp.dest('dist/mobile/cordova/www'));
        
    /* source: http://andy-carter.com/blog/a-beginners-guide-to-the-task-runner-gulp */
    // return gulp.src('src/js/*.js')
    //   .pipe(concat('main.js'))
    //     .pipe(rename({suffix: '.min'}))
    //     .pipe(uglify())
    //     .pipe(gulp.dest('build/js'));
});