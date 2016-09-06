var stdlib = require("./stdlib.js");
var types = stdlib.types;
var enums = stdlib.enums;
var builtins = stdlib.builtins;

function IndentedBuffer(){
    this.lines = [];
    this.indentation = 0;
}

IndentedBuffer.prototype.indent = function (amount) {
	this.indentation += amount;
};

IndentedBuffer.prototype.write = function (line, extra) {
	if (extra) {
		this.indent(extra);
	}
	this.lines.push(Array(this.indentation + 1).join("\t") + line);
	if (extra) {
		this.indent(-extra);
	}
};

var mangleLocal = local => "_" + local;
var box = (struct, quotedFieldName) => "{ \"ref\": " + struct + ", \"field\": " + quotedFieldName + " }";
var unboxRef = struct => struct + "[\"ref\"]";
var unboxField = struct => struct + "[\"field\"]";
var unbox = struct => unboxRef(struct) + "[" + unboxField(struct) + "]";
var caseNameForEnum = fullEnumName => fullEnumName.match(/^\w+\.(\w+)\!/)[1];

function CodeGen(parser) {
	this.buffer = new IndentedBuffer();
	this.usedBuiltins = {};
}

CodeGen.prototype.writeBuiltIn = function (name) {
	if (!this.usedBuiltins[name]) {
		var builtin = builtins[name];
		if (!builtin) {
			return false;
		}
		this.usedBuiltins[name] = true;
		this.buffer.lines.unshift("function " + name + builtin);
	}
	return true;
}

CodeGen.prototype.writeBranchToBlock = function (descriptor, siblingBlocks) {
	if (descriptor.reference) {
		for (var i = 0; i < siblingBlocks.length; i++) {
			if (siblingBlocks[i].name == descriptor.reference) {
				this.buffer.write("state = " + i + ";");
				return;
			}
		}
		throw "Unable to find block with name: " + targetBlock.reference;
	}
	if (descriptor.inline) {
		this.buffer.write("// " + descriptor.name);
		this.writeBasicBlock(descriptor.inline, siblingBlocks);
	} else {
		throw "Neither a reference to a basic block nor inline!";
	}
}

function findBasicBlock(blocks, descriptor) {
	if (descriptor.reference) {
		for (var i = 0; i < blocks.length; i++) {
			if (blocks[i].name == descriptor.reference) {
				return blocks[i];
			}
		}
		throw "Unable to find basic block: " + reference;
	}
	if (descriptor.inline) {
		return descriptor.inline;
	}
	throw "Neither a reference nor an inline block!";
}

CodeGen.prototype.writeBasicBlock = function (basicBlock, siblingBlocks) {
	for (var j = 0; j < basicBlock.instructions.length; j++) {
		var instruction = basicBlock.instructions[j];
		this.buffer.write("// " + instruction.type);
		switch (instruction.type) {
			case "assignment":
				this.buffer.write("// of " + instruction.instruction);
				var declaration = "var " + mangleLocal(instruction.destinationLocalName) + " = ";
				switch (instruction.instruction) {
					case "integer_literal":
						declaration += instruction.value;
						break;
					case "string_literal":
						declaration += instruction.value;
						break;
					case "enum":
						var enumName = instruction.enumName;
						var enumLayout = enums[enumName];
						if (!enumLayout) {
							throw "Unable to find enum: " + enumName;
						}
						if ("sourceLocalName" in instruction) {
							declaration += "[" + enumLayout.indexOf(instruction.caseName) + ", " + mangleLocal(instruction.sourceLocalName) + "]";
						} else {
							declaration += "[" + enumLayout.indexOf(instruction.caseName) + "]";
						}
						break;
					case "struct":
						var structName = instruction.structName;
						var structType = types[structName];
						if (!structType) {
							throw "No type for " + structName;
						}
						declaration += "{ " + instruction.arguments.map((arg, index) => "\"" + structType[index] + "\": " + mangleLocal(arg)).join(", ") + " }";
						break;
					case "tuple":
						declaration += "[ " + instruction.arguments.map(mangleLocal).join(", ") + " ]";
						break;
					case "struct_extract":
						declaration += mangleLocal(instruction.sourceLocalName) + JSON.stringify([instruction.fieldName]);
						break;
					case "tuple_extract":
						declaration += mangleLocal(instruction.sourceLocalName) + JSON.stringify([instruction.fieldIndex | 0]);
						break;
					case "builtin":
						var builtinName = instruction.builtinName;
						declaration += builtinName + "(" + instruction.arguments.map(mangleLocal).join(", ") + ")";
						if (!this.writeBuiltIn(builtinName)) {
							throw "No builtin available for " + builtinName + " (expects " + instruction.arguments.length + " arguments)";
						}
						break;
					case "function_ref":
						var functionName = instruction.functionName;
						declaration += functionName;
						this.writeBuiltIn(functionName);
						break;
					case "apply":
						declaration += mangleLocal(instruction.sourceLocalName) + "(" + instruction.arguments.map(mangleLocal).join(", ") + ")";
						break;
					case "alloc_stack":
						if ("sourceLocalName" in instruction) {
							declaration += box("[" + mangleLocal(instruction.sourceLocalName) + "]", 0);
						} else {
							declaration += box("[]", 0);
						}
						break;
					case "alloc_box":
						declaration += "[]";
						break;
					case "project_box":
						declaration += box(mangleLocal(instruction.sourceLocalName), 0);
						break;
					case "struct_element_addr":
						declaration += box(mangleLocal(instruction.sourceLocalName), "\"" + instruction.fieldName + "\"");
						break;
					case "global_addr":
						declaration += box(instruction.globalName, 0);
						break;
					case "load":
						declaration += unbox(mangleLocal(instruction.sourceLocalName));
						break;
					case "unchecked_enum_data":
						declaration += mangleLocal(instruction.sourceLocalName) + "[1]";
						break;
					case "unchecked_addr_cast":
					case "unchecked_ref_cast":
					case "pointer_to_address":
					case "address_to_pointer":
					case "ref_to_raw_pointer":
					case "raw_pointer_to_ref":
						declaration += mangleLocal(instruction.sourceLocalName);
						break;
					case "index_raw_pointer":
						//declaration += mangleLocal(instruction.sourceLocalName);
						//declaration += "; if (" + mangleLocal(instruction.offsetLocalName) + ") throw \"Pointer arithmetic disallowed!\"";
						//break;
					case "index_addr":
						declaration += box(unboxRef(mangleLocal(instruction.sourceLocalName)), unboxField(mangleLocal(instruction.sourceLocalName)) + " + " + mangleLocal(instruction.offsetLocalName));
						break;
					default:
						declaration += "undefined /* unknown instruction " + instruction.instruction + ": " + instruction.arguments + " */";
						break;
				}
				this.buffer.write(declaration + ";");
				break;
			case "return":
				this.buffer.write("return " + mangleLocal(instruction.localName) + ";");
				break;
			case "branch":
				var args = instruction.arguments;
				var targetBlock = findBasicBlock(siblingBlocks, instruction.block);
				for (var k = 0; k < args.length; k++) {
					this.buffer.write("var " + mangleLocal(targetBlock.arguments[k]) + " = " + mangleLocal(args[k]) + ";");
				}
				this.writeBranchToBlock(instruction.block, siblingBlocks);
				break;
			case "conditional_branch":
				this.buffer.write("if (" + mangleLocal(instruction.localName) + ") {");
				this.buffer.indent(1);
				this.writeBranchToBlock(instruction.trueBlock, siblingBlocks);
				this.buffer.indent(-1);
				this.buffer.write("} else {");
				this.buffer.indent(1);
				this.writeBranchToBlock(instruction.falseBlock, siblingBlocks);
				this.buffer.indent(-1);
				this.buffer.write("}");
				break;
			case "store":
				this.buffer.write(unbox(mangleLocal(instruction.destinationLocalName)) + " = " + mangleLocal(instruction.sourceLocalName) + ";");
				break;
			case "switch_enum":
				this.buffer.write("switch (" + mangleLocal(instruction.localName) + ") {")
				var args = instruction.cases;
				var enumName = basicNameForStruct(args[0].case);
				var enumLayout = enums[enumName];
				if (!enumLayout) {
					throw "Unable to find enum: " + enumName;
				}
				for (var k = 0; k < args.length; k++) {
					this.buffer.write("case " + enumLayout.indexOf(caseNameForEnum(args[k].case)) + ":");
					this.buffer.indent(1);
					var targetBlock = findBasicBlock(siblingBlocks, args[k].basicBlock);
					if (targetBlock.arguments.length > 0) {
						this.buffer.write("var " + mangleLocal(targetBlock.arguments[0]) + " = " + mangleLocal(instruction.localName) + "[1];");
					}
					this.writeBranchToBlock(args[k].basicBlock, siblingBlocks);
					this.buffer.indent(-1);
				}
				this.buffer.write("}");
				break;
			case "try_apply":
				this.buffer.write("try {");
				var normalBasicBlock = findBasicBlock(siblingBlocks, instruction.normalBlock);
				this.buffer.indent(1);
				this.buffer.write("var " + mangleLocal(normalBasicBlock.arguments[0]) + " = " + mangleLocal(instruction.localName) + "(" + instruction.arguments.map(mangleLocal).join(", ") + ");");
				this.writeBranchToBlock(instruction.normalBlock, siblingBlocks);
				this.buffer.indent(-1);
				this.buffer.write("} catch (e) {");
				var errorBasicBlock = findBasicBlock(siblingBlocks, instruction.errorBlock);
				this.buffer.indent(1);
				this.buffer.write("var " + mangleLocal(errorBasicBlock.arguments[0]) + " = e;");
				this.writeBranchToBlock(instruction.errorBlock, siblingBlocks);
				this.buffer.indent(-1);
				this.buffer.write("}");
				break;
			case "unreachable":
				this.buffer.write("throw \"Should be unreachable!\";");
				break;
			default:
				this.buffer.write("// Unhandled instruction type: " + instruction.type + ": " + JSON.stringify(instruction));
				break;
		}
	}
}

CodeGen.prototype.consume = function(declaration) {
	switch (declaration.type) {
		case "function":
			this.consumeFunction(declaration);
			break;
		case "global":
			this.consumeGlobal(declaration);
			break;
	}
}

CodeGen.prototype.consumeGlobal = function(declaration) {
	this.buffer.write("var " + declaration.name + " = []");
}

CodeGen.prototype.consumeFunction = function(declaration) {
	var basicBlocks = declaration.basicBlocks;
	if (basicBlocks.length == 0) {
		// No basic blocks, some kind of weird declaration we don't support yet
		return;
	}
	this.buffer.write("function " + declaration.name + "(" + basicBlocks[0].arguments.map(mangleLocal).join(", ") + ") {");
	this.buffer.indent(1);
	if (basicBlocks.length == 1) {
		this.writeBasicBlock(basicBlocks[0], basicBlocks);
	} else {
		var firstBlockHasBackreferences = basicBlocks[0].referencesFrom.length > 0;
		if (firstBlockHasBackreferences) {
			this.buffer.write("var state = 0;");
		} else {
			this.buffer.write("var state;");
			this.writeBasicBlock(basicBlocks[0], basicBlocks);
		}
		this.buffer.write("for (;;) switch(state) {")
		for (var i = firstBlockHasBackreferences ? 0 : 1; i < basicBlocks.length; i++) {
			var basicBlock = basicBlocks[i];
			this.buffer.write("case " + i + ": // " + basicBlock.name);
			this.buffer.indent(1);
			this.writeBasicBlock(basicBlocks[i], basicBlocks);
			this.buffer.write("break;");
			this.buffer.indent(-1);
		}
		this.buffer.write("}");
	}
	this.buffer.indent(-1);
	this.buffer.write("}");
	var beautifulName = declaration.beautifulName;
	if (beautifulName) {
		this.buffer.write("window[\"" + beautifulName + "\"] = " + declaration.name + ";");
	}
}

module.exports = CodeGen;
