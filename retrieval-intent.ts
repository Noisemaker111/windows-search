/** Identify only self-contained numeric expressions; this never evaluates or answers them. */
export function isCalculation(query:string){
 const expression=query.trim().replace(/^(?:what(?:'s| is)|calculate|compute|how much is)\s+/i,'').replace(/[?=]\s*$/,'').trim()
 if(/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(expression))return false
 if(/[.,]/.test(expression.replace(/\d+(?:,\d{3})*(?:\.\d+)?/g,'')))return false
 return expression.length>0&&expression.length<=240&&/^[\d\s.,()+*/%×÷^−-]+$/.test(expression)&&/\d/.test(expression)&&/[+*/%×÷^−-]/.test(expression)
}
export function needsWeb(query:string,hasLocalHits:boolean){
 return !hasLocalHits&&!/^(where|find|locate|open|play|run|launch)\b/i.test(query.trim())&&!isCalculation(query)
}
