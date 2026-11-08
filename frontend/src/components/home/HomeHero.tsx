import React from 'react'
import { ArrowRight, Ticket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HomeHeroPreview } from './HomeHeroPreview'
import './home-hero.css'

export const HomeHero: React.FC = () => {
  return (
    <section className="rx-hero" aria-labelledby="rx-hero-title">
      <div className="rx-hero-photo" aria-hidden="true">
        {/* Workspace photograph from Unsplash, used under the Unsplash License. */}
        <img src="/landing/workspace.jpg" alt="" />
      </div>

      <div className="rx-wrap rx-hero-grid">
        <div className="rx-hero-copy">
          <p className="rx-kicker">
            <Ticket size={14} aria-hidden="true" />
            Issue &amp; Ticket Management Platform
          </p>
          <h1 id="rx-hero-title">
            Turn Issues into <span>Resolutions.</span>
          </h1>
          <p className="rx-hero-lead">
            A unified platform for organizations and clients to raise, track, assign, and resolve tickets with clarity and accountability.
          </p>
          <div className="rx-hero-actions">
            <Link className="rx-btn rx-btn-primary" to="/register">
              Get Started
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="rx-btn rx-btn-secondary" to="/login">
              Login
            </Link>
          </div>
          <p className="rx-hero-trust">Built for teams that value clarity, ownership, and accountability.</p>
        </div>

        <div className="rx-hero-stage">
          <HomeHeroPreview />
          <p className="rx-hero-sample-note">Sample interface. Ticket figures are illustrative.</p>
        </div>
      </div>
    </section>
  )
}
