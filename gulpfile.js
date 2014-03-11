var gulp = require('gulp');
var browserify = require('gulp-browserify');

gulp.task('default', function() {
});

gulp.task('scripts', function() {
  // Only run the entrypoint, browserify gets the dependencies
  return gulp.src('ui/ui_main.js')
    .pipe(browserify({
      debug: true
    }))
    .pipe(gulp.dest('./build'));
});
