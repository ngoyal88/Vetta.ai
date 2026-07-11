import { fieldLabelClass, fieldTextClass, inputClass, textareaClass } from './formStyles';

type IdentitySectionFormProps = {
  name: string;
  email: string;
  phone: string;
  location: string;
  github: string;
  linkedin: string;
  portfolio: string;
  otherLinks: string;
  visibleFields: string[];
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onGithubChange: (value: string) => void;
  onLinkedinChange: (value: string) => void;
  onPortfolioChange: (value: string) => void;
  onOtherLinksChange: (value: string) => void;
};

export default function IdentitySectionForm(props: IdentitySectionFormProps) {
  const show = (field: string) => props.visibleFields.includes(field);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {show('name') ? (
        <label className={fieldLabelClass}>
          <span className={fieldTextClass}>Name</span>
          <input
            name="builder-name"
            autoComplete="name"
            value={props.name}
            onChange={(event) => props.onNameChange(event.target.value)}
            className={inputClass}
            placeholder="Jane Doe…"
          />
        </label>
      ) : null}

      {show('email') ? (
        <label className={fieldLabelClass}>
          <span className={fieldTextClass}>Email</span>
          <input
            name="builder-email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={props.email}
            onChange={(event) => props.onEmailChange(event.target.value)}
            className={inputClass}
            placeholder="jane@example.com…"
          />
        </label>
      ) : null}

      {show('phone') ? (
        <label className={fieldLabelClass}>
          <span className={fieldTextClass}>Phone</span>
          <input
            name="builder-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={props.phone}
            onChange={(event) => props.onPhoneChange(event.target.value)}
            className={inputClass}
            placeholder="+1 555 010 1234…"
          />
        </label>
      ) : null}

      {show('location') ? (
        <label className={fieldLabelClass}>
          <span className={fieldTextClass}>Location</span>
          <input
            name="builder-location"
            autoComplete="address-level2"
            value={props.location}
            onChange={(event) => props.onLocationChange(event.target.value)}
            className={inputClass}
            placeholder="Bengaluru, India…"
          />
        </label>
      ) : null}

      {show('github') ? (
        <label className={fieldLabelClass}>
          <span className={fieldTextClass}>GitHub</span>
          <input
            name="builder-github"
            type="url"
            autoComplete="url"
            spellCheck={false}
            value={props.github}
            onChange={(event) => props.onGithubChange(event.target.value)}
            className={inputClass}
            placeholder="https://github.com/username…"
          />
        </label>
      ) : null}

      {show('linkedin') ? (
        <label className={fieldLabelClass}>
          <span className={fieldTextClass}>LinkedIn</span>
          <input
            name="builder-linkedin"
            type="url"
            autoComplete="url"
            spellCheck={false}
            value={props.linkedin}
            onChange={(event) => props.onLinkedinChange(event.target.value)}
            className={inputClass}
            placeholder="https://linkedin.com/in/username…"
          />
        </label>
      ) : null}

      {show('portfolio') ? (
        <label className={fieldLabelClass}>
          <span className={fieldTextClass}>Portfolio</span>
          <input
            name="builder-portfolio"
            type="url"
            autoComplete="url"
            spellCheck={false}
            value={props.portfolio}
            onChange={(event) => props.onPortfolioChange(event.target.value)}
            className={inputClass}
            placeholder="https://portfolio.dev…"
          />
        </label>
      ) : null}

      {show('other_links') ? (
        <label className={`${fieldLabelClass} md:col-span-2`}>
          <span className={fieldTextClass}>Other links</span>
          <textarea
            name="builder-other-links"
            rows={3}
            value={props.otherLinks}
            onChange={(event) => props.onOtherLinksChange(event.target.value)}
            className={textareaClass}
            placeholder="Add one URL per line…"
          />
        </label>
      ) : null}
    </div>
  );
}
