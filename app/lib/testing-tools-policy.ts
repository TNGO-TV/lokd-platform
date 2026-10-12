// Officer- and client-facing sandbox tools (synthetic identity checks, test enrolment, test cycles,
// sandbox workflows) are an owner tool, not part of the onboarding product. They are available only
// when LOKD_TESTING_TOOLS_ENABLED=true. Operations keeps its own testing pages regardless.
export function testingToolsEnabledFor(runtime: { LOKD_TESTING_TOOLS_ENABLED?: string }) {
  return runtime.LOKD_TESTING_TOOLS_ENABLED === "true";
}
