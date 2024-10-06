const lifecycleHooks = new Set([
  "super",
  "constructor",
  "ngOnInit",
  "ngOnDestroy",
  "ngAfterViewInit",
  "componentDidMount",
  "componentWillUnmount",
  "shouldComponentUpdate",
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
  console.log("inside skip");
  if (hasControlFlow(functionBody)) {
    return true;
  }
  if (lifecycleHooks.has(functionName)) {
    return true;
  }
  return false;
}
