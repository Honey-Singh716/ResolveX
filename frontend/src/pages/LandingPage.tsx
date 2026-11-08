import React, { useState } from 'react'
import { BarChart3, Menu, ShieldCheck, Users, X, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HomeHero } from '../components/home/HomeHero'

const FEATURES = [
  { icon: Users, title: 'Multi-Organization', text: 'Manage multiple teams and clients.' },
  { icon: ShieldCheck, title: 'Role-Based Access', text: 'Secure and controlled access.' },
  { icon: Zap, title: 'Faster Resolution', text: 'Track, assign, and close issues efficiently.' },
  { icon: BarChart3, title: 'Actionable Insights', text: 'Stay informed with issue reports.' },
] as const

const PRODUCT = [
  {
    title: 'Organizations and clients',
    text: 'Create an organization, invite members, or join with a code. Clients and teams stay in one workspace.',
  },
  {
    title: 'Tickets with priority and status',
    text: 'Raise an issue, set its priority, and follow it from open to in progress, resolved, or closed.',
  },
  {
    title: 'Assignment and ownership',
    text: 'Assign tickets to team members and keep comments, status, and responsibility in one record.',
  },
] as const

const STEPS = [
  { title: 'Create an account', text: 'Register, then sign in to your client portal.' },
  { title: 'Join or request an organization', text: 'Use an invite code, or submit a new organization for review.' },
  { title: 'Raise a ticket', text: 'Describe the issue, choose a priority, and send it to the organization.' },
  { title: 'Track it to resolution', text: 'Teams assign the ticket, update its status, and close it when the work is done.' },
] as const

const FLOW = ['Organization', 'Client', 'Ticket', 'Assignee'] as const

export const LandingPage: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="rx-landing">
      <header className="rx-nav">
        <div className="rx-wrap rx-nav-bar">
          <Link to="/" className="rx-nav-brand" onClick={closeMenu}>
            <span className="rx-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <rect x="1" y="1" width="6" height="6" rx="1.4" />
                <rect x="9" y="1" width="6" height="6" rx="1.4" opacity="0.55" />
                <rect x="1" y="9" width="6" height="6" rx="1.4" opacity="0.55" />
                <rect x="9" y="9" width="6" height="6" rx="1.4" />
              </svg>
            </span>
            ResolveX
          </Link>

          <nav className="rx-nav-links" aria-label="Landing">
            <a href="#product">Product</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
          </nav>

          <div className="rx-nav-actions">
            <Link className="rx-nav-login" to="/login">Login</Link>
            <Link className="rx-btn rx-btn-primary rx-btn-compact" to="/register">Get Started</Link>
            <button
              className="rx-nav-menu"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="landing-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
              <span>{menuOpen ? 'Close' : 'Menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <nav id="landing-menu" className="rx-nav-drawer" aria-label="Landing sections">
          <a href="#product" onClick={closeMenu}>Product</a>
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#how-it-works" onClick={closeMenu}>How It Works</a>
          <Link to="/login" onClick={closeMenu}>Login</Link>
          <Link to="/register" onClick={closeMenu}>Get Started</Link>
        </nav>
      )}

      <main>
        <HomeHero />

        <section id="product" className="rx-section" aria-labelledby="product-title">
          <div className="rx-wrap">
            <div className="rx-product-head">
              <p className="rx-kicker">Product</p>
              <h2 id="product-title">One workspace for organizations and the clients they support.</h2>
              <p className="rx-lede">
                Clients raise tickets. Organization teams assign them, follow status and priority, and close the work with a named owner.
              </p>
            </div>

            <ol className="rx-flow" aria-label="How a ticket moves through ResolveX">
              {FLOW.map((label, index) => (
                <li key={label}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {label}
                </li>
              ))}
            </ol>

            <div className="rx-product-list">
              {PRODUCT.map((item, index) => (
                <article key={item.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="rx-section rx-section-tight" aria-labelledby="features-title">
          <div className="rx-wrap rx-features">
            <div className="rx-features-copy">
              <p className="rx-kicker">Features</p>
              <h2 id="features-title">What teams use ResolveX for.</h2>
              <ul className="rx-feature-rows">
                {FEATURES.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <li key={feature.title}>
                      <span className="rx-feature-icon">
                        <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                      </span>
                      <strong>{feature.title}</strong>
                      <span>{feature.text}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
            <figure className="rx-features-photo">
              <img
                src="/landing/features-team.jpg"
                alt="Three colleagues reviewing work together on a laptop."
              />
            </figure>
          </div>
        </section>

        <section id="how-it-works" className="rx-section" aria-labelledby="how-title">
          <div className="rx-wrap">
            <p className="rx-kicker">How it works</p>
            <h2 id="how-title">From a new account to a closed ticket.</h2>
            <ol className="rx-timeline">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="rx-final" aria-labelledby="final-title">
          <div className="rx-wrap">
            <div className="rx-final-panel">
              <div>
                <h2 id="final-title">Give every issue a clear path to resolution.</h2>
                <p>Bring your clients and teams into one organized workspace.</p>
              </div>
              <div className="rx-hero-actions">
                <Link className="rx-btn rx-btn-light" to="/register">Get Started</Link>
                <Link className="rx-btn rx-btn-ghost" to="/login">Login</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="rx-footer">
        <div className="rx-wrap rx-footer-grid">
          <div>
            <Link to="/" className="rx-nav-brand rx-footer-brand">
              <span className="rx-mark rx-mark-on-dark" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <rect x="1" y="1" width="6" height="6" rx="1.4" />
                  <rect x="9" y="1" width="6" height="6" rx="1.4" opacity="0.55" />
                  <rect x="1" y="9" width="6" height="6" rx="1.4" opacity="0.55" />
                  <rect x="9" y="9" width="6" height="6" rx="1.4" />
                </svg>
              </span>
              ResolveX
            </Link>
            <p>A workspace where organizations and clients raise, assign, and resolve tickets together.</p>
          </div>
          <nav aria-label="Footer">
            <strong>Product</strong>
            <a href="#product">Product</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
          </nav>
          <nav aria-label="Account">
            <strong>Account</strong>
            <Link to="/login">Login</Link>
            <Link to="/register">Get Started</Link>
          </nav>
        </div>
        <div className="rx-wrap rx-footer-meta">
          <small>© {new Date().getFullYear()} ResolveX. All rights reserved.</small>
        </div>
      </footer>
    </div>
  )
}
