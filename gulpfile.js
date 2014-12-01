'use strict';
var gulp = require('gulp')
  , path = require('path')
  , builder = require('systemjs-builder');

gulp.task('scripts', function() {
  return builder.build('app/app', 'public/js/build.js', {
    config: {
      baseURL: path.resolve('public/js'),
      meta: {
        'lib/selectonic': { deps: ['lib/jquery'] },
        'lib/webfont': {format:'global', exports: 'WebFont'}
      }
    }
  })['catch'](function(reason) {
    console.log(reason.stack || reason);
  });
});

gulp.task('default', ['scripts']);
gulp.watch('public/js/app/*.js', ['scripts']) 