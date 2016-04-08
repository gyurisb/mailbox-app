var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

gulp.task('build', function() {
    
    gulp.src('src/email/*.js')
        .pipe(gulp.dest('dist/desktop/main'))
        .pipe(gulp.dest('dist/mobile/server'));
    gulp.src('src/ui/**/*')
        .pipe(gulp.dest('dist/desktop/renderer'))
        .pipe(gulp.dest('dist/mobile/cordova/www'));
        
    /* source: http://andy-carter.com/blog/a-beginners-guide-to-the-task-runner-gulp */
    // return gulp.src('src/js/*.js')
    //   .pipe(concat('main.js'))
    //     .pipe(rename({suffix: '.min'}))
    //     .pipe(uglify())
    //     .pipe(gulp.dest('build/js'));
});