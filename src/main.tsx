import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import Layout from './components/Layout'
import { Spinner } from './components/Status'
import { AuthProvider } from './state/auth'
import { CommunitiesProvider } from './state/communities'
import { FollowsProvider } from './state/follows'
import { PrefsProvider } from './state/prefs'
import { ToastProvider } from './state/toast'
import Home, { Following } from './pages/Home'
import Legal from './pages/Legal'
import Welcome from './pages/Welcome'
import CommunityPage from './pages/CommunityPage'
import NotFound from './pages/NotFound'
const Communities = lazy(() => import('./pages/Communities'))
const Profile = lazy(() => import('./pages/Profile'))
const Submit = lazy(() => import('./pages/Submit'))
const PostPage = lazy(() => import('./pages/PostPage'))
const Snaps = lazy(() => import('./pages/Snaps'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <PrefsProvider>
          <AuthProvider>
            <FollowsProvider>
              <CommunitiesProvider>
                <Suspense fallback={<Spinner />}>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route index element={<Home />} />
                      <Route path="following" element={<Following />} />
                      <Route path="welcome" element={<Welcome />} />
                      <Route path="communities" element={<Communities />} />
                      <Route path="snaps" element={<Snaps />} />
                      <Route path="c/:id" element={<CommunityPage />} />
                      <Route path="p/:author/:permlink" element={<PostPage />} />
                      <Route path="u/:account" element={<Profile />} />
                      <Route path="submit" element={<Submit />} />
                      <Route path="legal" element={<Legal />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Routes>
                </Suspense>
              </CommunitiesProvider>
            </FollowsProvider>
          </AuthProvider>
        </PrefsProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
