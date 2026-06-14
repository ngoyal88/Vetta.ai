import { LandingFeatures } from '../components/LandingFeatures';
import { LandingHero } from '../components/LandingHero';
import { WebsiteLayout } from '../components/WebsiteLayout';

export default function HomePage() {
  return (
    <WebsiteLayout mainClassName="pb-32">
      <LandingHero />
      <LandingFeatures />
    </WebsiteLayout>
  );
}
