/**
 * Helper scripts ejecutados EN el build host (vía runScript: se escriben a
 * /tmp y corren con ruby/python). Encapsulan la lógica de App Store Connect
 * (spaceship, viene con fastlane) y Google Play (google-api-python-client).
 * Reciben parámetros por variables de entorno para no exponerlos en ARGV.
 */

/** App Store Connect via spaceship. ARGV[0] = status | submit. */
export const ASC_RUBY = String.raw`
require 'spaceship'
key_id = ENV['ASC_KEY_ID']; issuer = ENV['ASC_ISSUER']; kp = ENV['ASC_KEY_PATH']; bundle = ENV['ASC_BUNDLE']
Spaceship::ConnectAPI.token = Spaceship::ConnectAPI::Token.create(key_id: key_id, issuer_id: issuer, filepath: File.expand_path(kp))
app = Spaceship::ConnectAPI::App.find(bundle)
plat = Spaceship::ConnectAPI::Platform::IOS
cmd = ARGV[0]
case cmd
when 'status'
  live = app.get_live_app_store_version
  edit = app.get_edit_app_store_version
  puts "APP #{app.name} (#{app.id})"
  puts "LIVE: #{live && live.version_string} #{live && live.app_store_state}"
  puts "EDIT: #{edit ? edit.version_string : '(ninguna editable)'} #{edit && edit.app_store_state}"
  rs = app.get_in_progress_review_submission(platform: plat) rescue nil
  puts "REVIEW_SUBMISSION: #{rs ? rs.state : '(ninguna)'}"
  app.get_builds(includes: 'preReleaseVersion', sort: '-uploadedDate', limit: 6).each do |b|
    pv = b.pre_release_version
    puts "BUILD #{pv && pv.version} (#{b.version}) #{b.processing_state}"
  end
when 'submit'
  version = ENV['ASC_VERSION']; build_num = ENV['ASC_BUILD']; notes = ENV['ASC_NOTES']; locale = ENV['ASC_LOCALE'] || 'en-US'
  if ENV['ASC_CANCEL_REVIEW'] == '1'
    rs = app.get_in_progress_review_submission(platform: plat) rescue nil
    if rs; rs.cancel_submission; puts "Revision cancelada (#{rs.state})"; sleep 4; end
  end
  edit = app.get_edit_app_store_version
  if edit && version && edit.version_string != version
    edit.update(attributes: { version_string: version }); puts "Version renombrada a #{version}"
    edit = app.get_edit_app_store_version
  end
  raise 'No hay version editable. Subi el binario primero (beta_ios/altool) y reintenta.' unless edit
  if build_num && !build_num.empty?
    b = app.get_builds(includes: 'preReleaseVersion', sort: '-uploadedDate', limit: 8).find { |x| x.version == build_num }
    raise "Build #{build_num} no encontrado/procesado" unless b
    edit.select_build(build_id: b.id); puts "Build #{build_num} seleccionado"
  end
  if notes && !notes.empty?
    loc = edit.get_app_store_version_localizations.find { |l| l.locale == locale } || edit.get_app_store_version_localizations.first
    loc.update(attributes: { whats_new: notes }); puts "whatsNew seteado (#{loc.locale})"
  end
  submission = (app.get_ready_review_submission(platform: plat) rescue nil)
  submission ||= app.create_review_submission(platform: plat)
  submission.add_app_store_version_to_review_items(app_store_version_id: edit.id)
  submission.submit_for_review
  puts 'SUBMITTED'
end
`;

/** Google Play via google-api-python-client. ARGV[0] = status | upload. */
export const PLAY_PY = String.raw`
import os, sys, warnings; warnings.simplefilter('ignore')
from google.oauth2 import service_account
from googleapiclient.discovery import build as gbuild
from googleapiclient.http import MediaFileUpload
KEY = os.path.expanduser(os.environ['PLAY_JSON']); PKG = os.environ['PLAY_PKG']
creds = service_account.Credentials.from_service_account_file(KEY, scopes=['https://www.googleapis.com/auth/androidpublisher'])
svc = gbuild('androidpublisher', 'v3', credentials=creds, cache_discovery=False)
cmd = sys.argv[1]
edit = svc.edits().insert(packageName=PKG, body={}).execute(); eid = edit['id']
try:
    if cmd == 'status':
        tr = svc.edits().tracks().list(packageName=PKG, editId=eid).execute()
        for t in tr.get('tracks', []):
            rels = [(r.get('status'), r.get('name'), r.get('versionCodes')) for r in t.get('releases', [])]
            print(f"track {t.get('track')}: {rels}")
        svc.edits().delete(packageName=PKG, editId=eid).execute()
    elif cmd == 'upload':
        aab = os.path.expanduser(os.environ['PLAY_AAB']); track = os.environ.get('PLAY_TRACK', 'production'); status = os.environ.get('PLAY_STATUS', 'completed')
        media = MediaFileUpload(aab, mimetype='application/octet-stream', resumable=True)
        b = svc.edits().bundles().upload(packageName=PKG, editId=eid, media_body=media, ackBundleInstallationWarning=True).execute()
        vc = b['versionCode']; print('bundle versionCode', vc)
        rel = {'versionCodes': [str(vc)], 'status': status}
        notes = os.environ.get('PLAY_NOTES')
        if notes: rel['releaseNotes'] = [{'language': os.environ.get('PLAY_LANG', 'es-419'), 'text': notes}]
        svc.edits().tracks().update(packageName=PKG, editId=eid, track=track, body={'track': track, 'releases': [rel]}).execute()
        svc.edits().commit(packageName=PKG, editId=eid).execute()
        print(f'COMMIT OK -> track {track} vc {vc} status {status}')
except Exception as e:
    try: svc.edits().delete(packageName=PKG, editId=eid).execute()
    except Exception: pass
    raise
`;
