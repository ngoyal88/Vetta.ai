import type { ReactNode } from 'react';

import type { ResumeProfile, ResumeWorkExperienceItem } from 'features/vault/types';
import {
  fallbackProjectDescription,
  formatEducationDisplay,
  formatEmploymentTypeLabel,
  getResumeDisplayName,
  normalizeAchievements,
  normalizeEducation,
  normalizeLinkItems,
  normalizeProjects,
} from 'features/application-fit/utils/parsedResumePreviewUtils';
import { normalizeSkillGroups } from 'features/vault/utils/resumeSkills';

type ParsedResumePreviewProps = {
  profile: ResumeProfile | null | undefined;
};

function ParsedSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="application-fit-resume-preview__section">
      <div className="application-fit-resume-preview__section-heading">
        <h3 className="application-fit-resume-preview__section-title">{title}</h3>
      </div>
      <div className="application-fit-resume-preview__section-body">{children}</div>
    </section>
  );
}

function PreviewFieldRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="application-fit-resume-preview__field-row">
      <span className="application-fit-resume-preview__field-label">{label}</span>
      <span className="application-fit-resume-preview__field-value">{value}</span>
    </div>
  );
}

export function ParsedResumePreview({ profile }: ParsedResumePreviewProps) {
  if (!profile) {
    return (
      <div className="application-fit-resume-preview__empty">
        <p className="type-body-md text-[var(--color-on-surface-variant)]">
          Parsed resume data is unavailable for this version.
        </p>
      </div>
    );
  }

  const contact = profile.contact ?? {};
  const linkItems = normalizeLinkItems(contact.links ?? {});
  const skillGroups = normalizeSkillGroups(profile.skills);
  const education = normalizeEducation(profile.education);
  const achievements = normalizeAchievements(profile.achievements);
  const projects = normalizeProjects(profile.projects);
  const workExperience: ResumeWorkExperienceItem[] = Array.isArray(profile.work_experience)
    ? profile.work_experience
    : [];

  return (
    <div className="application-fit-resume-preview">
      <ParsedSection title="Basics">
        <p className="application-fit-resume-preview__name">{getResumeDisplayName(profile.name)}</p>
        <div className="application-fit-resume-preview__meta-grid">
          {contact.email ? (
            <div className="application-fit-resume-preview__meta-item">
              <p className="application-fit-resume-preview__meta-label">Email</p>
              <p className="application-fit-resume-preview__meta-value">{contact.email}</p>
            </div>
          ) : null}
          {contact.phone ? (
            <div className="application-fit-resume-preview__meta-item">
              <p className="application-fit-resume-preview__meta-label">Phone</p>
              <p className="application-fit-resume-preview__meta-value">{contact.phone}</p>
            </div>
          ) : null}
          {contact.location ? (
            <div className="application-fit-resume-preview__meta-item">
              <p className="application-fit-resume-preview__meta-label">Location</p>
              <p className="application-fit-resume-preview__meta-value">{contact.location}</p>
            </div>
          ) : null}
        </div>
        {linkItems.length ? (
          <div className="application-fit-resume-preview__link-list">
            {linkItems.map((item) => (
              <a
                key={`${item.label}-${item.href}`}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="application-fit-resume-preview__link"
                title={item.href}
              >
                <span className="application-fit-resume-preview__link-label">{item.label}</span>
                <span className="application-fit-resume-preview__link-text">{item.text}</span>
              </a>
            ))}
          </div>
        ) : null}
      </ParsedSection>

      {profile.summary ? (
        <ParsedSection title="Summary">
          <p className="application-fit-resume-preview__summary">{profile.summary}</p>
        </ParsedSection>
      ) : null}

      {skillGroups.length ? (
        <ParsedSection title="Skills">
          <div className="application-fit-resume-preview__skill-groups">
            {skillGroups.map((group) => (
              <div key={group.label} className="application-fit-resume-preview__skill-group">
                <p className="application-fit-resume-preview__meta-label">{group.label}</p>
                <div className="application-fit-resume-preview__chip-list">
                  {group.items.map((item) => (
                    <span key={`${group.label}-${item}`} className="application-fit-resume-preview__chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ParsedSection>
      ) : null}

      {workExperience.length ? (
        <ParsedSection title="Work Experience">
          <div className="application-fit-resume-preview__stack">
            {workExperience.map((item, index) => {
              const title = item.title ?? '';
              const company = item.company ?? item.organization ?? '';
              const startDate = item.start_date ?? '';
              const endDate = item.end_date ?? '';
              const employmentTypeLabel = formatEmploymentTypeLabel(item.employment_type);
              const bullets = [
                ...(item.responsibilities ?? []).filter((line): line is string => Boolean(line?.trim())),
                ...(item.impact ?? []).filter((line): line is string => Boolean(line?.trim())),
              ];

              return (
                <div key={`exp-${index}`} className="application-fit-resume-preview__card">
                  <div className="application-fit-resume-preview__card-header">
                    <div className="application-fit-resume-preview__card-header-main">
                      {title ? <p className="application-fit-resume-preview__card-heading">{title}</p> : null}
                      {company ? (
                        <p className="application-fit-resume-preview__card-subheading">{company}</p>
                      ) : null}
                      {!title && !company ? (
                        <p className="application-fit-resume-preview__card-heading">Experience</p>
                      ) : null}
                    </div>
                    <div className="application-fit-resume-preview__card-badges">
                      {employmentTypeLabel ? (
                        <span className="application-fit-resume-preview__role-badge">
                          {employmentTypeLabel}
                        </span>
                      ) : null}
                      {startDate || endDate ? (
                        <span className="application-fit-resume-preview__date-badge">
                          {[startDate, endDate].filter(Boolean).join(' – ')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {bullets.length ? (
                    <ul className="application-fit-resume-preview__bullet-list">
                      {bullets.map((bullet, bulletIndex) => (
                        <li key={`exp-${index}-bullet-${bulletIndex}`}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ParsedSection>
      ) : null}

      {projects.length ? (
        <ParsedSection title="Projects">
          <div className="application-fit-resume-preview__stack">
            {projects.map((project, index) => {
              const description =
                project.description || fallbackProjectDescription(project.name, profile.raw_text);
              return (
                <div
                  key={`project-${index}`}
                  className="application-fit-resume-preview__card application-fit-resume-preview__card--project"
                >
                  <div className="application-fit-resume-preview__card-header">
                    <div className="application-fit-resume-preview__card-header-main min-w-0">
                      <p className="application-fit-resume-preview__card-heading">{project.name || 'Project'}</p>
                      {description ? (
                        <p className="application-fit-resume-preview__project-description">{description}</p>
                      ) : null}
                    </div>
                    {project.link ? (
                      <a
                        href={project.link.startsWith('http') ? project.link : `https://${project.link}`}
                        target="_blank"
                        rel="noreferrer"
                        className="application-fit-resume-preview__card-link"
                      >
                        Open link
                      </a>
                    ) : null}
                  </div>
                  {project.role || project.scale ? (
                    <p className="application-fit-resume-preview__card-meta">
                      {[project.role, project.scale].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                  {project.techStack.length ? (
                    <div className="application-fit-resume-preview__chip-list application-fit-resume-preview__chip-list--project">
                      {project.techStack.map((tech) => (
                        <span key={`${project.name}-${tech}`} className="application-fit-resume-preview__chip">
                          {tech}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ParsedSection>
      ) : null}

      {education.length ? (
        <ParsedSection title="Education">
          <div className="application-fit-resume-preview__stack">
            {education.map((item, index) => {
              const display = formatEducationDisplay(item);
              return (
                <div
                  key={`edu-${index}`}
                  className="application-fit-resume-preview__card application-fit-resume-preview__card--education"
                >
                  {item.institution ? (
                    <p className="application-fit-resume-preview__card-heading">{item.institution}</p>
                  ) : null}
                  {display.degree || display.major || display.minor ? (
                    <div className="application-fit-resume-preview__field-list">
                      <PreviewFieldRow label="Degree" value={display.degree} />
                      <PreviewFieldRow label="Major" value={display.major} />
                      <PreviewFieldRow label="Minor" value={display.minor} />
                    </div>
                  ) : null}
                  {display.metaLine ? (
                    <p className="application-fit-resume-preview__card-meta">{display.metaLine}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ParsedSection>
      ) : null}

      {achievements.length ? (
        <ParsedSection title="Achievements">
          <div className="application-fit-resume-preview__stack">
            {achievements.map((item, index) => (
              <div key={`achievement-${index}`} className="application-fit-resume-preview__card">
                <div className="application-fit-resume-preview__card-header">
                  <p className="application-fit-resume-preview__card-heading">{item.title}</p>
                  {item.date ? (
                    <span className="application-fit-resume-preview__date-badge">{item.date}</span>
                  ) : null}
                </div>
                {item.description ? (
                  <p className="application-fit-resume-preview__card-body">{item.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </ParsedSection>
      ) : null}

      {profile.raw_text ? (
        <details className="application-fit-resume-preview__raw">
          <summary className="application-fit-resume-preview__raw-summary">Raw parsed text</summary>
          <pre className="application-fit-resume-preview__raw-text">{profile.raw_text}</pre>
        </details>
      ) : null}
    </div>
  );
}
