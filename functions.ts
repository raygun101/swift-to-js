import { Term } from "./ast";
import { ReifiedType, reifyType } from "./reified";
import { addDeclaration, addVariable, DeclarationFlags, emitScope, lookup, mangleName, newScope, rootScope, Scope } from "./scope";
import { Function, Type } from "./types";
import { annotate, ArgGetter, call, callable, expr, Location, read, stringifyType, typeFromValue, Value } from "./values";

import { blockStatement, Expression, functionDeclaration, functionExpression, identifier, Identifier, returnStatement, Statement, thisExpression } from "babel-types";

export type FunctionBuilder = (scope: Scope, arg: ArgGetter, type: Function, name: string) => Value;

export interface GetterSetterBuilder {
	get: FunctionBuilder;
	set: FunctionBuilder;
}

function getArgumentPointers(type: Type): boolean[] {
	if (type.kind === "function") {
		return type.arguments.types.map((arg) => arg.kind === "modified" && arg.modifier === "inout");
	}
	throw new TypeError(`Expected a function, got a ${type.kind}: ${stringifyType(type)}`);
}

export function functionize(scope: Scope, expression: (scope: Scope, arg: ArgGetter) => Value, location?: Location | Term): [Identifier[], Statement[]] {
	const inner: Scope = newScope("anonymous", scope);
	let usedCount = 0;
	const identifiers: { [index: number]: Identifier } = Object.create(null);
	const newValue = expression(inner, (i, name) => {
		if (usedCount === -1) {
			throw new Error(`Requested access to scope after it was generated!`);
		}
		if (usedCount <= i) {
			usedCount = i + 1;
		}
		let result: Identifier;
		if (Object.hasOwnProperty.call(identifiers, i)) {
			result = identifiers[i];
		} else {
			result = identifiers[i] = identifier(typeof name === "string" ? name : "$" + i);
		}
		// TODO: Determine what to do about inout parameters
		return expr(result);
	});
	const args: Identifier[] = [];
	for (let i = 0; i < usedCount; i++) {
		args[i] = Object.hasOwnProperty.call(identifiers, i) ? identifiers[i] : identifier("$" + i);
	}
	let statements: Statement[];
	if (newValue.kind === "statements") {
		statements = newValue.statements;
	} else {
		statements = [annotate(returnStatement(read(newValue, inner)), newValue.location || location)];
	}
	const result = emitScope(inner, statements);
	usedCount = -1;
	return [args, result];
}

export function insertFunction(name: string, scope: Scope, type: Function, builder: FunctionBuilder | GetterSetterBuilder, location?: Location | Term, shouldExport: boolean = false): Value {
	if (typeof builder === "undefined") {
		throw new Error(`Cannot find function named ${name}`);
	}
	if (Object.hasOwnProperty.call(scope.functionUsage, name)) {
		return lookup(name, scope);
	}
	scope.functionUsage[name] = true;
	const globalScope = rootScope(scope);
	const [args, statements] = functionize(globalScope, (inner, arg) => (typeof builder === "function" ? builder : builder.get)(inner, arg, type, name), location);
	return addDeclaration(globalScope, name, (id) => functionDeclaration(id, args, blockStatement(statements)), shouldExport ? DeclarationFlags.Export : DeclarationFlags.None);
}

export function noinline(builder: FunctionBuilder): FunctionBuilder {
	return (scope: Scope, arg: ArgGetter, type: Type, name: string) => {
		if (type.kind !== "function") {
			throw new Error(`Expected function, got ${stringifyType(type)}`);
		}
		return call(insertFunction(name, scope, type, builder), type.arguments.types.map((_, i) => arg(i)), type.arguments.types, scope);
	};
}

export function wrapped(fn: (scope: Scope, arg: ArgGetter, type: Function, typeArgument: ReifiedType) => Value): FunctionBuilder {
	return (scope: Scope, arg: ArgGetter, type: Type, name: string): Value => {
		const typeArgument = typeFromValue(arg(0, "type"), scope);
		const innerType = returnFunctionType(type);
		return callable((innerScope, innerArg) => fn(innerScope, innerArg, innerType, typeArgument), innerType);
	};
}

export const abstractMethod: FunctionBuilder = (scope, arg, type, name) => {
	throw new TypeError(`Abstract method ${name} not overridden`);
};

export function returnType(type: Type) {
	if (type.kind === "function") {
		return type.return;
	}
	throw new Error(`Expected a function type, got a ${type.kind} type`);
}

export function returnFunctionType(type: Type): Function {
	const result = returnType(type);
	if (result.kind !== "function") {
		throw new Error(`Expected to recieve a function that returns a function, instead it returns ${stringifyType(result)}`);
	}
	return result;
}
