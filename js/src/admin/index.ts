import app from 'flarum/admin/app';
import MagicBBPage from './components/MagicBBPage';

app.initializers.add('forumaker-magicbb', () => {
  app.extensionData
    .for('forumaker-magicbb')
    .registerPage(MagicBBPage)
    .registerPermission(
      {
        icon: 'fas fa-tv',
        label: app.translator.trans('forumaker-magicbb.admin.permissions.use_iframe'),
        permission: 'forumaker-magicbb.use_iframe',
      },
      'reply'
    )
    .registerPermission(
      {
        icon: 'fas fa-thumbs-up',
        label: app.translator.trans('forumaker-magicbb.admin.permissions.bypass_like'),
        permission: 'post.bypasslikeRequirement',
      },
      'reply'
    )
    .registerPermission(
      {
        icon: 'fas fa-reply',
        label: app.translator.trans('forumaker-magicbb.admin.permissions.bypass_reply'),
        permission: 'post.bypassreplyRequirement',
      },
      'reply'
    );
});