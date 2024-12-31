const lifecycleHooks = new Set([
  "super",
  "constructor",
  "ngOnInit",
  "ngOnDestroy",
  "ngAfterViewInit",
  "ngAfterViewChecked",
  "ngAfterContentInit",
  "ngAfterContentChecked",
  "ngDoCheck",
  "componentDidMount",
  "componentWillUnmount",
  "shouldComponentUpdate",
  "componentDidUpdate",
  "componentWillReceiveProps",
  "render",
]);
function hasControlFlow(body: string): boolean {
  return /if\s*\(|for\s*\(|while\s*\(|switch\s*\(|else\s*|else\s+if\s*\(|do\s*\{/.test(
    body
  );
}
export function shouldSkipConversion(
  functionName: string,
  functionBody: string
): boolean {
  if (hasControlFlow(functionBody)) {
    return true;
  }
  if (lifecycleHooks.has(functionName)) {
    return true;
  }
  return false;
}
export function mapParameters(
  functionParameters: {
    name: string;
    type: string | null;
    defaultValue: string | null;
  }[]
) {
  return functionParameters
    .map(
      (param: {
        name: string;
        type: string | null;
        defaultValue: string | null;
      }) =>
        `${param.name}${param.type ? `: ${param.type}` : ""}${
          param.defaultValue ? ` = ${param.defaultValue}` : ""
        }`
    )
    .join(", ");
}
