const SKIP_PRECHECK_KEY = "vetta_skip_precheck";

export const getSkipPrecheck = (): boolean => {
  try {
    return window.localStorage.getItem(SKIP_PRECHECK_KEY) === "1";
  } catch (err) {
    return false;
  }
};

export const setSkipPrecheck = (skip: boolean): void => {
  try {
    if (skip) {
      window.localStorage.setItem(SKIP_PRECHECK_KEY, "1");
    } else {
      window.localStorage.removeItem(SKIP_PRECHECK_KEY);
    }
  } catch (err) {
    // Ignore storage errors in restricted environments.
  }
};
