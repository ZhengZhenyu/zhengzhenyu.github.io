/* ═══════════════════════════════════════════════════════ */
/*  Stone Theme — Hexo Helpers                            */
/* ═══════════════════════════════════════════════════════ */

// Register a 404 page generator
hexo.extend.generator.register('error_404', function(locals) {
  return {
    path: '404.html',
    data: {
      type: '404',
      title: '404 - Page Not Found'
    },
    layout: 'index'
  };
});

// Helper: get page title with site name
hexo.extend.helper.register('page_title', function() {
  var title = this.page.title;
  if (title) {
    return title + ' · ' + this.config.title;
  }
  return this.config.title;
});

// Helper: get post thumbnail (for Open Graph)
hexo.extend.helper.register('thumbnail', function(post) {
  if (!post) return '';
  return post.thumbnail || post.banner || '';
});

// Helper: format date
hexo.extend.helper.register('format_date', function(date, format) {
  if (!date) return '';
  return this.date(date, format || 'YYYY-MM-DD');
});
