import { noinline, returnFunctionType, returnType, wrapped } from "./functions";
import { copyValue, expressionSkipsCopy, field, Field, FunctionMap, inheritLayout, PossibleRepresentation, primitive, ReifiedType, reifyType, struct, TypeParameterHost } from "./reified";
import { emitScope, mangleName, newScope, rootScope, Scope, uniqueIdentifier } from "./scope";
import { parse as parseType, Tuple, Type } from "./types";
import { cached, expectLength } from "./utils";
import { ArgGetter, call, callable, expr, ExpressionValue, functionValue, hoistToIdentifier, isNestedOptional, read, reuseExpression, set, statements, stringifyType, tuple, unbox, undefinedValue, Value, variable } from "./values";

import { arrayExpression, assignmentExpression, binaryExpression, blockStatement, booleanLiteral, callExpression, conditionalExpression, Expression, expressionStatement, functionExpression, identifier, Identifier, ifStatement, isLiteral, logicalExpression, memberExpression, newExpression, nullLiteral, NullLiteral, numericLiteral, objectExpression, returnStatement, Statement, stringLiteral, thisExpression, ThisExpression, throwStatement, unaryExpression, variableDeclaration, variableDeclarator } from "babel-types";

function returnOnlyArgument(scope: Scope, arg: ArgGetter): Value {
	return arg(0);
}

function returnThis(scope: Scope, arg: ArgGetter): Value {
	return arg("this");
}

function returnTodo(scope: Scope, arg: ArgGetter, type: Type, name: string): Value {
	console.log(name);
	return call(expr(mangleName("todo_missing_builtin$" + name)), undefinedValue, [], scope);
}

function returnLength(scope: Scope, arg: ArgGetter): Value {
	const arg0 = arg(0);
	return arg0.kind === "direct" ? variable(read(arg0, scope)) : expr(read(arg0, scope));
}

function binaryBuiltin(operator: "+" | "-" | "*" | "/" | "%" | "<" | ">" | "<=" | ">=" | "&" | "|" | "^" | "==" | "===" | "!=" | "!==") {
	return wrapped((scope: Scope, arg: ArgGetter) => expr(binaryExpression(operator, read(arg(0), scope), read(arg(1), scope))));
}

function assignmentBuiltin(operator: "=" | "+=" | "-=" | "*=" | "/=" | "|=" | "&=") {
	return wrapped((scope: Scope, arg: ArgGetter) => set(arg(0), arg(1), scope, operator));
}

const readLengthField = (name: string, globalScope: Scope) => field("count", reifyType("Int", globalScope), (value, scope) => {
	return expr(memberExpression(read(value, scope), identifier("length")));
});

const isEmptyFromLength = (globalScope: Scope) => field("isEmpty", reifyType("Bool", globalScope), (value, scope) => {
	return expr(binaryExpression("!==", memberExpression(read(value, scope), identifier("length")), numericLiteral(0)));
});

const startIndexOfZero = (globalScope: Scope) => field("startIndex", reifyType("Int64", globalScope), (value: Value, scope: Scope) => {
	return expr(numericLiteral(0));
});

const voidType: Tuple = { kind: "tuple", types: [] };

export const forceUnwrapFailed: Value = functionValue("Swift.(swift-to-js).forceUnwrapFailed()", undefined, { kind: "function", arguments: voidType, return: voidType, throws: true, rethrows: false, attributes: [] });

export const defaultTypes: { [name: string]: (globalScope: Scope, typeParameters: TypeParameterHost) => ReifiedType } = {
	"Bool": cached(() => primitive(PossibleRepresentation.Boolean, expr(booleanLiteral(false)), [], {
		"init(_builtinBooleanLiteral:)": wrapped(returnOnlyArgument),
		"_getBuiltinLogicValue()": (scope, arg, type) => callable(() => arg(0), returnType(type)),
		"&&": wrapped((scope, arg) => expr(logicalExpression("&&", read(arg(0), scope), read(call(arg(1), undefinedValue, [], scope), scope)))),
		"||": wrapped((scope, arg) => expr(logicalExpression("||", read(arg(0), scope), read(call(arg(1), undefinedValue, [], scope), scope)))),
	})),
	"SignedNumeric": cached(() => primitive(PossibleRepresentation.Number, expr(numericLiteral(0)), [], {
		"-": wrapped((scope, arg) => expr(unaryExpression("-", read(arg(0), scope)))),
	})),
	"Int": cached(() => primitive(PossibleRepresentation.Number, expr(numericLiteral(0)), [], {
		"init(_builtinIntegerLiteral:)": wrapped(returnOnlyArgument),
		"+": binaryBuiltin("+"),
		"-": binaryBuiltin("-"),
		"*": binaryBuiltin("*"),
		"/": (scope, arg) => expr(binaryExpression("|", binaryExpression("/", read(arg(0), scope), read(arg(1), scope)), numericLiteral(0))),
		"%": binaryBuiltin("%"),
		"<": binaryBuiltin("<"),
		">": binaryBuiltin(">"),
		"<=": binaryBuiltin("<="),
		">=": binaryBuiltin(">="),
		"&": binaryBuiltin("&"),
		"|": binaryBuiltin("|"),
		"^": binaryBuiltin("^"),
		"==": binaryBuiltin("==="),
		"!=": binaryBuiltin("!=="),
		"+=": assignmentBuiltin("+="),
		"-=": assignmentBuiltin("-="),
		"*=": assignmentBuiltin("*="),
	})),
	"Int64": cached(() => primitive(PossibleRepresentation.Number, expr(numericLiteral(0)))),
	"FloatingPoint": cached(() => primitive(PossibleRepresentation.Number, expr(numericLiteral(0)), [], {
		"==": binaryBuiltin("==="),
		"!=": binaryBuiltin("!=="),
		"squareRoot()": (scope, arg, type) => callable(() => expr(callExpression(memberExpression(identifier("Math"), identifier("sqrt")), [read(arg(0), scope)])), returnType(type)),
	})),
	"Float": cached(() => primitive(PossibleRepresentation.Number, expr(numericLiteral(0)), [], {
		"init(_builtinIntegerLiteral:)": wrapped(returnOnlyArgument),
		"+": binaryBuiltin("+"),
		"-": binaryBuiltin("-"),
		"*": binaryBuiltin("*"),
		"/": binaryBuiltin("/"),
		"%": binaryBuiltin("%"),
		"<": binaryBuiltin("<"),
		">": binaryBuiltin(">"),
		"<=": binaryBuiltin("<="),
		">=": binaryBuiltin(">="),
		"&": binaryBuiltin("&"),
		"|": binaryBuiltin("|"),
		"^": binaryBuiltin("^"),
		"==": binaryBuiltin("==="),
		"!=": binaryBuiltin("!=="),
		"+=": assignmentBuiltin("+="),
		"-=": assignmentBuiltin("-="),
		"*=": assignmentBuiltin("*="),
		"/=": assignmentBuiltin("/="),
	})),
	"Double": cached(() => primitive(PossibleRepresentation.Number, expr(numericLiteral(0)), [], {
		"init(_builtinIntegerLiteral:)": wrapped(returnOnlyArgument),
		"+": binaryBuiltin("+"),
		"-": binaryBuiltin("-"),
		"*": binaryBuiltin("*"),
		"/": binaryBuiltin("/"),
		"%": binaryBuiltin("%"),
		"<": binaryBuiltin("<"),
		">": binaryBuiltin(">"),
		"<=": binaryBuiltin("<="),
		">=": binaryBuiltin(">="),
		"&": binaryBuiltin("&"),
		"|": binaryBuiltin("|"),
		"^": binaryBuiltin("^"),
		"==": binaryBuiltin("==="),
		"!=": binaryBuiltin("!=="),
		"+=": assignmentBuiltin("+="),
		"-=": assignmentBuiltin("-="),
		"*=": assignmentBuiltin("*="),
		"/=": assignmentBuiltin("/="),
	})),
	"String": (globalScope) => {
		const UnicodeScalarView = primitive(PossibleRepresentation.Array, expr(arrayExpression([])), [
			field("count", reifyType("Int", globalScope), (value, scope) => expr(memberExpression(read(value, scope), identifier("length")))),
			field("startIndex", reifyType("Int64", globalScope), (value, scope) => expr(numericLiteral(0))),
			field("endIndex", reifyType("Int64", globalScope), (value, scope) => expr(memberExpression(read(value, scope), identifier("length")))),
		]);
		const UTF16View = primitive(PossibleRepresentation.String, expr(stringLiteral("")), [
			field("count", reifyType("Int", globalScope), (value: Value, scope: Scope) => expr(memberExpression(read(value, scope), identifier("length")))),
			field("startIndex", reifyType("Int64", globalScope), (value: Value, scope: Scope) => expr(numericLiteral(0))),
			field("endIndex", reifyType("Int64", globalScope), (value: Value, scope: Scope) => expr(memberExpression(read(value, scope), identifier("length")))),
		]);
		const UTF8View = primitive(PossibleRepresentation.Array, expr(arrayExpression([])), [
			field("count", reifyType("Int", globalScope), (value: Value, scope: Scope) => expr(memberExpression(read(value, scope), identifier("length")))),
			field("startIndex", reifyType("Int64", globalScope), (value: Value, scope: Scope) => expr(numericLiteral(0))),
			field("endIndex", reifyType("Int64", globalScope), (value: Value, scope: Scope) => expr(memberExpression(read(value, scope), identifier("length")))),
		]);
		return primitive(PossibleRepresentation.String, expr(stringLiteral("")), [
			field("unicodeScalars", UnicodeScalarView, (value, scope) => call(expr(memberExpression(identifier("Array"), identifier("from"))), undefinedValue, [value], scope)),
			field("utf16", UTF16View, (value) => value),
			field("utf8", UTF8View, (value, scope) => call(expr(memberExpression(newExpression(identifier("TextEncoder"), [stringLiteral("utf-8")]), identifier("encode"))), undefinedValue, [value], scope)),
		], {
			"init": wrapped((scope, arg) => call(expr(identifier("String")), undefinedValue, [arg(0)], scope)),
			"+": binaryBuiltin("+"),
			"lowercased()": (scope, arg, type) => callable(() => call(expr(memberExpression(read(arg(0), scope), identifier("toLowerCase"))), undefinedValue, [], scope), returnType(type)),
			"uppercased()": (scope, arg, type) => callable(() => call(expr(memberExpression(read(arg(0), scope), identifier("toUpperCase"))), undefinedValue, [], scope), returnType(type)),
		}, {
			"UnicodeScalarView": () => UnicodeScalarView,
			"UTF16View": () => UTF16View,
			"UTF8View": () => UTF8View,
		});
	},
	"Optional": (globalScope, typeParameters) => {
		const [ wrappedType ] = typeParameters(1);
		const reified = reifyType(wrappedType, globalScope);
		const optionalType: Type = { kind: "optional", type: wrappedType };
		return {
			fields: [],
			functions: {
				"none": (scope, arg, type) => expr(emptyOptional(optionalType)),
				"some": wrapped((scope, arg, type) => wrapInOptional(arg(0, "wrapped"), optionalType, scope)),
				"==": binaryBuiltin("==="), // TODO: Fix to use proper comparator for internal type
				"!=": binaryBuiltin("!=="), // TODO: Fix to use proper comparator for internal type
				"flatMap": returnTodo,
			},
			possibleRepresentations: PossibleRepresentation.Array,
			defaultValue() {
				return expr(emptyOptional(wrappedType));
			},
			copy: reified.copy || isNestedOptional(optionalType) ? (value, scope) => {
				const expression = read(value, scope);
				if (expressionSkipsCopy(expression)) {
					return expr(expression);
				}
				if (reified.copy) {
					// Nested optionals require special support since they're stored as [] for .none, [null] for .some(.none) and [v] for .some(.some(v))
					const [first, after] = reuseExpression(expression, scope);
					return expr(conditionalExpression(
						optionalIsNone(first, optionalType),
						emptyOptional(optionalType),
						read(wrapInOptional(reified.copy(expr(after), scope), optionalType, scope), scope),
					));
				} else if (isNestedOptional(optionalType)) {
					// Nested Optionals of simple value are sliced
					return expr(callExpression(memberExpression(expression, identifier("slice")), []));
				} else {
					// Optionals of simple value are passed through
					return value;
				}
			} : undefined,
			innerTypes: {},
		};
	},
	// Should be represented as an empty struct, but we currently
	"_OptionalNilComparisonType": cached(() => primitive(PossibleRepresentation.Null, expr(nullLiteral()), [], {
		"init(nilLiteral:)": wrapped((scope, arg, type) => expr(nullLiteral())),
	})),
	"Array": (globalScope, typeParameters) => {
		const [ valueType ] = typeParameters(1);
		const reified = reifyType(valueType, globalScope);
		const optionalValueType: Type = { kind: "optional", type: valueType };
		const reifiedOptional = reifyType(optionalValueType, globalScope);
		return {
			fields: [
				readLengthField("count", globalScope),
				isEmptyFromLength(globalScope),
				readLengthField("capacity", globalScope),
				startIndexOfZero(globalScope),
				readLengthField("endIndex", globalScope),
				field("first", reifiedOptional, (value: Value, scope: Scope) => {
					const [first, after] = reuseExpression(read(value, scope), scope);
					return expr(conditionalExpression(
						memberExpression(first, identifier("length")),
						read(wrapInOptional(expr(memberExpression(after, numericLiteral(0), true)), optionalValueType, scope), scope),
						emptyOptional(optionalValueType),
					));
				}),
				field("last", reifiedOptional, (value: Value, scope: Scope) => {
					const [first, after] = reuseExpression(read(value, scope), scope);
					return expr(conditionalExpression(
						memberExpression(first, identifier("length")),
						read(wrapInOptional(expr(memberExpression(after, binaryExpression("-", memberExpression(after, identifier("length")), numericLiteral(1)), true)), optionalValueType, scope), scope),
						emptyOptional(optionalValueType),
					));
				}),
			],
			functions: {
				"init": wrapped((scope, arg) => call(expr(memberExpression(identifier("Array"), identifier("from"))), undefinedValue, [arg(0)], scope)),
				"count": returnLength,
				"subscript": {
					get(scope, arg) {
						return arrayBoundsCheck(arg(0, "array"), arg(1, "index"), scope, "read");
					},
					set(scope, arg) {
						return expr(assignmentExpression("=", read(arrayBoundsCheck(arg(0, "array"), arg(1, "index"), scope, "write"), scope), read(copyValue(arg(2, "value"), valueType, scope), scope)));
					},
				},
				"append()": wrapped((scope, arg) => {
					const pushExpression = expr(memberExpression(read(arg(0, "array"), scope), identifier("push")));
					const newElement = copyValue(arg(1, "newElement"), valueType, scope);
					return call(pushExpression, undefinedValue, [newElement], scope);
				}),
				"insert(at:)": wrapped((scope, arg) => {
					const array = arg(0, "array");
					const newElement = copyValue(arg(1, "newElement"), valueType, scope);
					const i = arg(2, "i");
					return call(functionValue("Swift.(swift-to-js).arrayInsertAt()", undefined, { kind: "function", arguments: { kind: "tuple", types: [] }, return: voidType, throws: true, rethrows: false, attributes: [] }), undefinedValue, [array, newElement, i], scope);
				}),
				"remove(at:)": wrapped((scope, arg) => {
					const array = arg(0, "array");
					const i = arg(1, "i");
					return call(functionValue("Swift.(swift-to-js).arrayRemoveAt()", undefined, { kind: "function", arguments: { kind: "tuple", types: [] }, return: voidType, throws: true, rethrows: false, attributes: [] }), undefinedValue, [array, i], scope);
				}),
				"removeFirst()": wrapped((scope, arg) => {
					const [first, after] = reuseExpression(callExpression(memberExpression(read(arg(0, "array"), scope), identifier("shift")), []), scope);
					return expr(conditionalExpression(
						binaryExpression("!==", first, read(undefinedValue, scope)),
						after,
						read(arrayBoundsFailed(scope), scope),
					));
				}),
				"removeLast()": wrapped((scope, arg) => {
					const [first, after] = reuseExpression(callExpression(memberExpression(read(arg(0, "array"), scope), identifier("pop")), []), scope);
					return expr(conditionalExpression(
						binaryExpression("!==", first, read(undefinedValue, scope)),
						after,
						read(arrayBoundsFailed(scope), scope),
					));
				}),
				"popLast()": wrapped((scope, arg) => {
					const [first, after] = reuseExpression(callExpression(memberExpression(read(arg(0, "array"), scope), identifier("pop")), []), scope);
					return expr(conditionalExpression(
						binaryExpression("!==", first, read(undefinedValue, scope)),
						read(wrapInOptional(expr(after), optionalValueType, scope), scope),
						emptyOptional(optionalValueType),
					));
				}),
				"removeAll(keepingCapacity:)": wrapped((scope, arg) => {
					return expr(assignmentExpression("=", memberExpression(read(arg(0, "array"), scope), identifier("length")), numericLiteral(0)));
				}),
				"reserveCapacity()": wrapped((scope, arg) => undefinedValue),
				"index(after:)": wrapped((scope, arg) => {
					const array = arg(0, "array");
					const i = arg(1, "i");
					const [first, after] = reuseExpression(read(i, scope), scope);
					return expr(conditionalExpression(
						binaryExpression("<", read(array, scope), first),
						binaryExpression("+", after, numericLiteral(1)),
						read(arrayBoundsFailed(scope), scope),
					));
				}),
				"index(before:)": wrapped((scope, arg) => {
					const i = arg(1, "i");
					const [first, after] = reuseExpression(read(i, scope), scope);
					return expr(conditionalExpression(
						binaryExpression(">", first, numericLiteral(0)),
						binaryExpression("-", after, numericLiteral(1)),
						read(arrayBoundsFailed(scope), scope),
					));
				}),
				"distance(from:to:)": wrapped((scope, arg) => {
					const start = arg(1, "start");
					const end = arg(2, "end");
					return expr(binaryExpression("-", read(end, scope), read(start, scope)));
				}),
			},
			possibleRepresentations: PossibleRepresentation.Array,
			defaultValue() {
				return expr(arrayExpression([]));
			},
			copy(value, scope) {
				const expression = read(value, scope);
				if (expressionSkipsCopy(expression)) {
					return expr(expression);
				}
				if (reified.copy) {
					// Arrays of complex types are mapped using a generated copy function
					const id = uniqueIdentifier(scope, "value");
					const converter = functionExpression(undefined, [id], blockStatement([returnStatement(read(reified.copy(expr(id), scope), scope))]));
					return expr(callExpression(memberExpression(expression, identifier("map")), [converter]));
				} else {
					// Simple arrays are sliced
					return expr(callExpression(memberExpression(expression, identifier("slice")), []));
				}
			},
			innerTypes: {},
		};
	},
	"Dictionary": (globalScope, typeParameters) => {
		const [ keyType, valueType ] = typeParameters(2);
		const possibleKeyType: Type = { kind: "optional", type: keyType };
		const possibleValueType: Type = { kind: "optional", type: valueType };
		const reifiedKeyType = reifyType(keyType, globalScope);
		const reifiedValueType = reifyType(valueType, globalScope);
		function objectDictionaryImplementation(converter?: Identifier): ReifiedType {
			const reifiedKeysType = reifyType({ kind: "array", type: keyType }, globalScope);
			return {
				fields: [
					field("count", reifyType("Int", globalScope), (value, scope) => expr(memberExpression(callExpression(memberExpression(identifier("Object"), identifier("keys")), [read(value, scope)]), identifier("length")))),
					field("keys", reifiedKeysType, (value: Value, scope: Scope) => {
						return expr(callExpression(memberExpression(identifier("Object"), identifier("keys")), [read(value, scope)]));
					}),
				],
				functions: {
					subscript: {
						get(scope, arg, type) {
							const dict = hoistToIdentifier(read(arg(0, "dict"), scope), scope, "dict");
							const index = hoistToIdentifier(read(arg(1, "index"), scope), scope, "index");
							return expr(conditionalExpression(
								callExpression(
									memberExpression(
										memberExpression(
											identifier("Object"),
											identifier("hasOwnProperty"),
										),
										identifier("call"),
									),
									[dict, index],
								),
								read(wrapInOptional(copyValue(expr(memberExpression(dict, index, true)), valueType, scope), possibleValueType, scope), scope),
								emptyOptional(possibleValueType),
							));
						},
						set(scope, arg, type) {
							const dict = hoistToIdentifier(read(arg(0, "dict"), scope), scope, "dict");
							const index = hoistToIdentifier(read(arg(1, "index"), scope), scope, "index");
							const valueExpression = read(arg(2, "value"), scope);
							const remove = unaryExpression("delete", memberExpression(dict, index, true));
							if (valueType.kind === "optional") {
								if (valueExpression.type === "ArrayExpression" && valueExpression.elements.length === 0) {
									return expr(remove);
								}
							} else {
								if (valueExpression.type === "NullLiteral") {
									return expr(remove);
								}
							}
							if (isLiteral(valueExpression) || valueExpression.type === "ArrayExpression" || valueExpression.type === "ObjectExpression") {
								return expr(assignmentExpression("=", memberExpression(dict, index, true), valueExpression));
							}
							const hoistedValue = hoistToIdentifier(valueExpression, scope, "value");
							return expr(conditionalExpression(
								optionalIsSome(hoistedValue, possibleValueType),
								assignmentExpression("=", memberExpression(dict, index, true), read(copyValue(unwrapOptional(expr(hoistedValue), possibleValueType, scope), valueType, scope), scope)),
								remove,
							));
						},
					},
				},
				possibleRepresentations: PossibleRepresentation.Object,
				defaultValue() {
					return expr(objectExpression([]));
				},
				copy(value, scope) {
					const expression = read(value, scope);
					if (expressionSkipsCopy(expression)) {
						return expr(expression);
					}
					if (reifiedValueType.copy) {
						throw new TypeError(`Copying dictionaries with non-simple values is not yet implemented!`);
					}
					return expr(callExpression(memberExpression(identifier("Object"), identifier("assign")), [objectExpression([]), expression]));
				},
				innerTypes: {
					Keys: () => {
						return inheritLayout(reifiedKeysType, [
							readLengthField("count", globalScope),
							isEmptyFromLength(globalScope),
							startIndexOfZero(globalScope),
							readLengthField("endIndex", globalScope),
							field("first", reifyType(possibleKeyType, globalScope), (value: Value, scope: Scope) => {
								const [first, after] = reuseExpression(read(value, scope), scope);
								const stringKey = memberExpression(after, numericLiteral(0), true);
								const convertedKey = typeof converter !== "undefined" ? callExpression(converter, [stringKey]) : stringKey;
								return expr(conditionalExpression(memberExpression(first, identifier("length")), read(wrapInOptional(expr(convertedKey), possibleKeyType, scope), scope), emptyOptional(possibleKeyType)));
							}),
							field("underestimatedCount", reifyType("Int", globalScope), (value: Value, scope: Scope) => {
								return expr(memberExpression(read(value, scope), identifier("length")));
							}),
						]);
					},
				},
			};
		}
		switch (reifiedKeyType.possibleRepresentations) {
			case PossibleRepresentation.String:
				return objectDictionaryImplementation();
			case PossibleRepresentation.Boolean:
				return objectDictionaryImplementation(identifier("Boolean"));
			case PossibleRepresentation.Number:
				return objectDictionaryImplementation(identifier("Number"));
			default:
				throw new Error(`No dictionary implementation for keys of type ${stringifyType(keyType)}`);
		}
	},
	"Collection": (globalScope, typeParameters) => primitive(PossibleRepresentation.Array, expr(arrayExpression([])), [
		field("count", reifyType("Int", globalScope), (value, scope) => expr(memberExpression(read(value, scope), identifier("length")))),
	], {
		map: (scope, arg) => expr(callExpression(memberExpression(memberExpression(arrayExpression([]), identifier("map")), identifier("bind")), [read(arg(0), scope)])),
	}),
	"BidirectionalCollection": (globalScope, typeParameters) => primitive(PossibleRepresentation.Array, expr(arrayExpression([])), [
		field("count", reifyType("Int", globalScope), (value, scope) => expr(memberExpression(read(value, scope), identifier("length")))),
	], {
		"joined(separator:)": (scope, arg, type): Value => {
			const collection = read(arg(0, "collection"), scope);
			return callable((innerScope, innerArg) => {
				const separator = read(innerArg(0, "separator"), scope);
				return expr(callExpression(memberExpression(collection, identifier("join")), [separator]));
			}, returnFunctionType(type));
		},
	}),
	"ClosedRange": (globalScope, typeParameters) => primitive(PossibleRepresentation.Array, expr(arrayExpression([]))),
	"Strideable": (globalScope, typeParameters) => primitive(PossibleRepresentation.Array, expr(arrayExpression([])), [], {
		"...": wrapped((scope, arg) => expr(arrayExpression([read(arg(0), scope), read(arg(1), scope)]))),
	}),
	"Hasher": cached(() => primitive(PossibleRepresentation.Number, expr(numericLiteral(0)), [
	], {
		"finalize()": wrapped((scope, arg, type): Value => {
			return arg(0, "hash");
		}),
	})),
};

export function emptyOptional(type: Type) {
	return isNestedOptional(type) ? arrayExpression([]) : nullLiteral();
}

export function wrapInOptional(value: Value, type: Type, scope: Scope) {
	return isNestedOptional(type) ? expr(arrayExpression([read(value, scope)])) : value;
}

export function unwrapOptional(value: Value, type: Type, scope: Scope) {
	if (isNestedOptional(type)) {
		return expr(memberExpression(read(value, scope), numericLiteral(0), true));
	}
	return value;
}

export function optionalIsNone(expression: Expression, type: Type): Expression {
	if (isNestedOptional(type)) {
		return binaryExpression("===", memberExpression(expression, identifier("length")), numericLiteral(0));
	}
	return binaryExpression("===", expression, nullLiteral());
}

export function optionalIsSome(expression: Expression, type: Type): Expression {
	if (isNestedOptional(type)) {
		return binaryExpression("!==", memberExpression(expression, identifier("length")), numericLiteral(0));
	}
	return binaryExpression("!==", expression, nullLiteral());
}

function arrayBoundsFailed(scope: Scope) {
	return call(functionValue("Swift.(swift-to-js).arrayBoundsFailed()", undefined, { kind: "function", arguments: voidType, return: voidType, throws: true, rethrows: false, attributes: [] }), undefinedValue, [], scope);
}

function arrayBoundsCheck(array: Value, index: Value, scope: Scope, mode: "read" | "write") {
	const [firstArray, remainingArray] = reuseExpression(read(array, scope), scope);
	const [firstIndex, remainingIndex] = reuseExpression(read(index, scope), scope);
	return variable(memberExpression(
		firstArray,
		conditionalExpression(
			logicalExpression(
				"&&",
				binaryExpression(mode === "write" ? ">=" : ">", memberExpression(remainingArray, identifier("length")), firstIndex),
				binaryExpression(">=", remainingIndex, numericLiteral(0)),
			),
			remainingIndex,
			read(arrayBoundsFailed(scope), scope),
		),
		true,
	));
}

export const functions: FunctionMap = {
	"Swift.(swift-to-js).forceUnwrapFailed()": noinline((scope, arg) => statements([throwStatement(newExpression(identifier("TypeError"), [stringLiteral("Unexpectedly found nil while unwrapping an Optional value")]))])),
	"Swift.(swift-to-js).arrayBoundsFailed()": noinline((scope, arg) => statements([throwStatement(newExpression(identifier("RangeError"), [stringLiteral("Array index out of range")]))])),
	"Swift.(swift-to-js).arrayInsertAt()": noinline((scope, arg) => {
		return statements([
			ifStatement(
				logicalExpression("||",
					binaryExpression(">",
						read(arg(2, "i"), scope),
						memberExpression(read(arg(0, "array"), scope), identifier("length")),
					),
					binaryExpression("<",
						read(arg(2, "i"), scope),
						numericLiteral(0),
					),
				),
				expressionStatement(read(arrayBoundsFailed(scope), scope)),
			),
			// TODO: Remove use of splice, since it's slow
			expressionStatement(callExpression(
				memberExpression(read(arg(0, "array"), scope), identifier("splice")),
				[
					read(arg(2, "i"), scope),
					numericLiteral(0),
					read(arg(1, "newElement"), scope),
				],
			)),
		]);
	}),
	"Swift.(swift-to-js).arrayRemoveAt()": noinline((scope, arg) => {
		return statements([
			ifStatement(
				logicalExpression("||",
					binaryExpression(">=",
						read(arg(1, "i"), scope),
						memberExpression(read(arg(0, "array"), scope), identifier("length")),
					),
					binaryExpression("<",
						read(arg(1, "i"), scope),
						numericLiteral(0),
					),
				),
				expressionStatement(read(arrayBoundsFailed(scope), scope)),
			),
			// TODO: Remove use of splice, since it's slow
			returnStatement(
				memberExpression(
					callExpression(
						memberExpression(read(arg(0, "array"), scope), identifier("splice")),
						[
							read(arg(1, "i"), scope),
							numericLiteral(1),
						],
					),
					numericLiteral(0),
					true,
				),
			),
		]);
	}),
	"Sequence.reduce": (scope, arg, type) => callable((innerScope, innerArg) => {
		return call(expr(identifier("Sequence$reduce")), undefinedValue, [arg(0)], scope);
	}, returnType(type)),
	"??": returnTodo,
	"~=": (scope, arg) => expr(binaryExpression("===", read(arg(0), scope), read(arg(1), scope))),
	"print(_:separator:terminator:)": (scope, arg, type) => call(expr(memberExpression(identifier("console"), identifier("log"))), undefinedValue, [arg(0, "items")], scope),
};

export function newScopeWithBuiltins(): Scope {
	return {
		name: "global",
		declarations: Object.create(null),
		types: Object.assign(Object.create(null), defaultTypes),
		functions: Object.assign(Object.create(null), functions),
		functionUsage: Object.create(null),
		mapping: Object.create(null),
		parent: undefined,
	};
}
