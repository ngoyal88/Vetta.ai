import type { BuilderCustomSection, BuilderSection } from '../types/resumeBuilder';
import type { ResumeProfile } from 'features/vault/types/domain';
import { ensureBuilderSkillGroups } from 'features/vault/utils/resumeSkills';
import type { useResumeBuilder } from '../hooks/useResumeBuilder';
import { resolveSectionFields } from '../utils/sectionFieldRegistry';
import {
  AchievementsSectionForm,
  CustomSectionForm,
  EducationSectionForm,
  IdentitySectionForm,
  ProjectsSectionForm,
  PublicationsSectionForm,
  SkillsSectionForm,
  SummarySectionForm,
  WorkExperienceSectionForm,
} from './SectionForms';

type SectionFormContentProps = {
  section: BuilderSection;
  profile: ResumeProfile;
  customSections: BuilderCustomSection[];
  builder: ReturnType<typeof useResumeBuilder>;
};

export function SectionFormContent({ section, profile, customSections, builder }: SectionFormContentProps) {
  const skillGroups = ensureBuilderSkillGroups(profile.skills);
  const visibleFields = resolveSectionFields(builder.activeTemplate, section.kind);

  switch (section.kind) {
    case 'identity':
      return (
        <IdentitySectionForm
          name={typeof profile.name === 'string' ? profile.name : ''}
          email={profile.contact?.email || ''}
          phone={profile.contact?.phone || ''}
          location={profile.contact?.location || ''}
          github={profile.contact?.links?.github || ''}
          linkedin={profile.contact?.links?.linkedin || ''}
          portfolio={profile.contact?.links?.portfolio || ''}
          otherLinks={(profile.contact?.links?.other || []).join('\n')}
          visibleFields={visibleFields}
          onNameChange={builder.setProfileName}
          onEmailChange={builder.setProfileEmail}
          onPhoneChange={builder.setProfilePhone}
          onLocationChange={builder.setProfileLocation}
          onGithubChange={(value) => builder.setProfileLinks('github', value)}
          onLinkedinChange={(value) => builder.setProfileLinks('linkedin', value)}
          onPortfolioChange={(value) => builder.setProfileLinks('portfolio', value)}
          onOtherLinksChange={builder.setProfileOtherLinks}
        />
      );
    case 'summary':
      return <SummarySectionForm summary={profile.summary || ''} onSummaryChange={builder.setSummary} />;
    case 'work_experience':
      return (
        <WorkExperienceSectionForm
          items={profile.work_experience || []}
          visibleFields={visibleFields}
          onAdd={builder.addWorkExperience}
          onChange={builder.setWorkExperienceItem}
          onRemove={builder.removeWorkExperience}
        />
      );
    case 'education':
      return (
        <EducationSectionForm
          items={profile.education || []}
          visibleFields={visibleFields}
          onAdd={builder.addEducation}
          onChange={builder.setEducationItem}
          onRemove={builder.removeEducation}
          onAddHighlight={builder.addEducationHighlight}
          onHighlightChange={builder.setEducationHighlight}
          onRemoveHighlight={builder.removeEducationHighlight}
        />
      );
    case 'skills':
      return (
        <SkillsSectionForm
          groups={skillGroups}
          onAddGroup={builder.addSkillGroup}
          onGroupChange={builder.setSkillGroup}
          onRemoveGroup={builder.removeSkillGroup}
        />
      );
    case 'projects':
      return (
        <ProjectsSectionForm
          items={profile.projects || []}
          visibleFields={visibleFields}
          onAdd={builder.addProject}
          onChange={builder.setProjectItem}
          onRemove={builder.removeProject}
        />
      );
    case 'achievements':
      return (
        <AchievementsSectionForm
          items={profile.achievements || []}
          onAdd={builder.addAchievement}
          onChange={builder.setAchievementItem}
          onRemove={builder.removeAchievement}
        />
      );
    case 'publications':
      return (
        <PublicationsSectionForm
          items={profile.publications || []}
          onAdd={builder.addPublication}
          onChange={builder.setPublicationItem}
          onRemove={builder.removePublication}
        />
      );
    case 'custom': {
      const customSection = customSections.find((entry) => entry.id === section.id);
      return customSection ? (
        <CustomSectionForm
          content={customSection.content}
          onContentChange={(value) => builder.updateCustomSectionContent(customSection.id, value)}
        />
      ) : null;
    }
    default:
      return null;
  }
}
