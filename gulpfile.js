var gulp = require('gulp');
var watchify = require('watchify');
var source = require('vinyl-source-stream');
var browserify = require('browserify');
var nodemon = require('gulp-nodemon');

/* Currently, there's some issue with Firefox's sourceMaps
   that makes it so that they don't work when using absolute
   urls. Use this module to eliminate the urls
*/
var path = require('path');
var mold = require('mold-source-map');
var root = path.join(__dirname, 'ui');
// For testing
var mocha = require('gulp-mocha');

gulp.task('watch-scripts', function() {
  var bundler = watchify('./ui/ui_main.js');

  function rebundle() {
    bundler.bundle({debug: true})
    .pipe(mold.transformSourcesRelativeTo(root))
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('./ui'));
  }
  bundler.on('update', rebundle);
  return rebundle();
});

gulp.task('nodemon', function() {
  return nodemon({script: 'main.js'});
});

gulp.task('scripts', function() {
  var bundler = browserify('./ui/ui_main.js');
  return bundler.bundle({debug: true})
    .pipe(mold.transformSourcesRelativeTo(root))
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('./ui'));
});

gulp.task('server-test', function() {
  return gulp.src('test/*_test.js')
    .pipe(mocha());
});

gulp.task('browser-test', function() {
  return gulp.src('browser_test/*_test.js')
    .pipe(mocha());
});


gulp.task('dev', ['nodemon', 'watch-scripts']);
gulp.task('test', ['server-test', 'browser-test']);
