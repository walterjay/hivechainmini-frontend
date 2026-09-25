import { Link } from 'react-router'
import { APP_NAME } from '../config'
import { useTitle } from '../lib/useTitle'

export default function Legal() {
  useTitle('Legal notice')
  return (
    <div className="prose prose-zinc max-w-none dark:prose-invert prose-a:text-brand">
      <h1>Legal notice</h1>
      <p className="text-sm text-muted">French law requires this information on every professional website.</p>

      <h2>Publisher</h2>
      <ul>
        <li>
          <strong>Name:</strong> Walter JAY
        </li>
        <li>
          <strong>Legal status:</strong> Sole trader (entrepreneur individuel, EI)
        </li>
        <li>
          <strong>SIREN:</strong> 978 812 402 (head office SIRET: 978 812 402 00011)
        </li>
        <li>
          <strong>Address:</strong> 7 B rue du Chapeau Rouge, 21000 Dijon, France
        </li>
        <li>
          <strong>Email:</strong> <a href="mailto:contact@walterjay.fr">contact@walterjay.fr</a>
        </li>
        <li>
          <strong>Publication director:</strong> Walter JAY
        </li>
      </ul>

      <h2>Host</h2>
      <ul>
        <li>
          <strong>Name:</strong> Cloudflare, Inc.
        </li>
        <li>
          <strong>Address:</strong> 101 Townsend Street, San Francisco, CA 94107, United States
        </li>
        <li>
          <strong>Phone:</strong> +1 650 319 8930
        </li>
      </ul>

      <h2>Personal data and cookies</h2>
      <p>
        {APP_NAME} sets no cookies and runs no analytics or tracking. The app itself is a static site: it has no server and no database
        of its own, and doesn't collect any personal data.
      </p>
      <p>
        A few preferences (dark mode, your sensitive-content filter, your saved communities and, if you log in, your session) are kept
        only in your browser's local storage. They're never sent anywhere and stay on your device until you clear them.
      </p>
      <p>
        Reading, posting, voting and following are all actions on the public <a href="https://hive.io">Hive blockchain</a>: your browser
        talks directly to public Hive API nodes (see <code>API_NODES</code> in the app's source) and, if you log in with HiveAuth, to the
        HiveAuth relay server, to let your wallet sign what you do. Anything you publish this way (posts, comments, votes, follows) is
        public and permanent on the Hive blockchain, independent of this app. The app never sees, asks for or stores your private keys.
      </p>
      <p>
        If you email me, your message is used only to reply to you. You can ask to see or delete that data at any time at{' '}
        <a href="mailto:contact@walterjay.fr">contact@walterjay.fr</a>.
      </p>

      <h2>Intellectual property</h2>
      <p>The app's own text, logo and code belong to Walter Jay unless stated otherwise. Please ask before reusing them.</p>
      <p>Content posted by Hive users through this app belongs to its authors, as with any other Hive front end.</p>

      <p>
        <Link to="/">← Back to the home page</Link>
      </p>
    </div>
  )
}
