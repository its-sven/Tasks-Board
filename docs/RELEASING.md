# Releasing Tasks Board

Releases are built by GitHub Actions ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) as soon as a version tag is pushed. The workflow

1. checks that the tag matches the version in `appinfo/info.xml` and `package.json`,
2. takes the release notes from the matching section in `CHANGELOG.md`,
3. builds `tasks_board.tar.gz` with `make appstore`,
4. signs the code if the App Store key is set up (see below),
5. publishes a GitHub release with the package and a SHA-256 checksum,
6. uploads the release to the Nextcloud App Store if the App Store is set up.

## Making a release

```bash
git switch tasks-board
git pull
node scripts/bump-version.mjs 1.0.1        # sets the version, adds a CHANGELOG section
# fill in CHANGELOG.md, remove empty headings
git commit -am "Release 1.0.1"
git tag -a v1.0.1 -m "Tasks Board 1.0.1"
git push --follow-tags
```

Follow the progress under **Actions → Release**. A tag with a suffix like `v1.1.0-beta.1` becomes a pre-release.

To build a release again (for example after setting up the App Store), run the workflow by hand: **Actions → Release → Run workflow** and enter the tag.

Versions follow [Semantic Versioning](https://semver.org): `1.0.1` for fixes, `1.1.0` for new features, `2.0.0` for changes that need attention when updating.

## Setting up the Nextcloud App Store (once)

The App Store needs a certificate for the app id `tasks_board`. Keep the private key safe: whoever has it can publish releases.

1. **Create a key and a certificate request** (on your own computer):

   ```bash
   mkdir -p ~/.nextcloud/certificates && cd ~/.nextcloud/certificates
   openssl req -nodes -newkey rsa:4096 -keyout tasks_board.key -out tasks_board.csr -subj "/CN=tasks_board"
   ```

2. **Request the certificate**: fork [nextcloud/app-certificate-requests](https://github.com/nextcloud/app-certificate-requests), add `tasks_board/tasks_board.csr` and open a pull request. After the merge the certificate is in that repository as `tasks_board/tasks_board.crt`; save it next to the key.

3. **Register the app** on [apps.nextcloud.com](https://apps.nextcloud.com) (log in → *Register app*). Paste the certificate and this signature:

   ```bash
   echo -n "tasks_board" | openssl dgst -sha512 -sign ~/.nextcloud/certificates/tasks_board.key | openssl base64
   ```

4. **Create an API token** on apps.nextcloud.com under *Account → API token*.

5. **Add the secrets** to the GitHub repository (*Settings → Secrets and variables → Actions → New repository secret*):

   | Secret | Content |
   | --- | --- |
   | `APP_PRIVATE_KEY` | the whole content of `tasks_board.key` |
   | `APPSTORE_TOKEN` | the API token |
   | `APP_CERTIFICATE` | optional, the content of `tasks_board.crt` (otherwise it is downloaded from app-certificate-requests) |

From now on every release is code signed and uploaded to the App Store. The App Store downloads the package from the GitHub release, so the repository has to be public.

The App Store shows the screenshots from `appinfo/info.xml`; they are loaded from the branch `tasks-board` in this repository.

More details: [App Store documentation for developers](https://nextcloudappstore.readthedocs.io/en/latest/developer.html).

## Repository settings (once)

* **Default branch** `tasks-board` (*Settings → General*), so that visitors, Dependabot and the release badge use it.
* **Social preview**: upload [`docs/social-preview.png`](social-preview.png) under *Settings → General → Social preview*.
* **Private vulnerability reporting** on (*Settings → Code security*), see [SECURITY.md](../SECURITY.md).
* **About**: description "Board, table and dashboard for your Nextcloud tasks", website of the App Store page once it exists, topics such as `nextcloud`, `nextcloud-app`, `tasks`, `kanban`, `caldav`, `todo`.
