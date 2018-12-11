import { MessageCollection } from '@aftercss/shared';
import { Token, TokenReader, TokenType } from '@aftercss/tokenizer';
import { CSSSyntaxError } from './parser-error';
import { CommentNode, Declaration, FunctionNode, ParserNode, QualifiedRule, Root } from './parser-node';
/**
 * Generate AST from Tokens
 */
export class Parser extends TokenReader {
  public topLevel: boolean = true;
  /**
   * generate CSSSyntaxError with location infos
   * @param message
   */
  public error(message: string) {
    const location = this.currentToken().start;
    return new CSSSyntaxError(location, message);
  }

  public allowWhiteSpace(): { start: number; space: string } {
    const whiteSpaceStart = this.currentToken().start;
    let whiteSpace = '';
    while (this.currentToken().type === TokenType.WHITESPACE) {
      whiteSpace += this.currentToken().raw;
      this.step();
    }
    return { start: whiteSpaceStart, space: whiteSpace };
  }

  /**
   * parse a stylesheet
   */
  public parseStyleSheet() {
    this.topLevel = true;
    const rules = this.consumeRuleList();
    const root = new Root();
    root.childNodes = rules;
    root.source.to = this.currentToken().start;
    return root;
  }

  /**
   * consume a list of rules
   */
  private consumeRuleList(): ParserNode[] {
    const childNodes: ParserNode[] = [];
    while (this.currentToken().type !== TokenType.EOF) {
      switch (this.currentToken().type) {
        case TokenType.WHITESPACE:
          this.step();
          break;
        case TokenType.CDO:
        case TokenType.CDC:
          if (this.topLevel) {
            this.step();
          }
          break;
        case TokenType.COMMENT:
          childNodes.push(new CommentNode(this.currentToken().content));
          break;
        case TokenType.ATKEYWORD:
          // childNodes.push(this.consumeAtRule());
          break;
        default:
          // TODO
          // qualified rule OR declaration
          childNodes.push(this.other());
      }
    }
    return childNodes;
  }

  private other() {
    const tokens: Token[] = [];
    while (true) {
      const currentToken = this.currentToken();
      this.step();
      switch (currentToken.type) {
        case TokenType.EOF:
        case TokenType.SEMI:
          return this.consumeDeclaration(tokens);
        case TokenType.LEFT_CURLY_BRACKET:
          return this.consumeQualifiedRule(tokens);
        case TokenType.WHITESPACE:
          break;
        default:
          tokens.push(currentToken);
      }
    }
  }

  /**
   * consume a declaration
   */

  private consumeDeclaration(tokens: Token[]) {
    const parser = new Parser(tokens);
    if (parser.currentToken().type !== TokenType.IDENT) {
      throw this.error('Invalid declaration');
    }
    const declNode = new Declaration();
    declNode.source.from = parser.currentToken().start - parser.currentToken().raw.length;
    declNode.name = parser.currentToken().content;
    parser.step();
    if (parser.currentToken().type !== TokenType.COLON) {
      throw this.error('Invalid declaration');
    }
    parser.step();
    while (parser.currentToken().type !== TokenType.EOF) {
      const currentToken = parser.currentToken();
      switch (currentToken.type) {
        case TokenType.COMMENT:
          parser.step();
          break;
        case TokenType.FUNCTION:
          const functionNode = parser.consumeFunction();
          declNode.value.push(functionNode);
          break;
        default:
          parser.step();
          declNode.value.push(currentToken);
      }
    }
    declNode.source.to = parser.currentToken().start;
    if (declNode.value.length < 2) {
      return declNode;
    }
    const lastToken = declNode.value.pop();
    const beforeLastToken = declNode.value.pop();
    if (
      lastToken instanceof Token &&
      beforeLastToken instanceof Token &&
      beforeLastToken.content === '!' &&
      lastToken.content.toLowerCase() === 'important'
    ) {
      declNode.important = true;
    } else {
      declNode.value.push(beforeLastToken, lastToken);
    }
    return declNode;
  }

  /**
   * consume a function Node
   */
  private consumeFunction() {
    const funcNode = new FunctionNode();
    funcNode.name = this.currentToken().content;
    funcNode.source.from = this.currentToken().start - this.currentToken().raw.length;
    this.step();
    while (true) {
      const currentToken = this.currentToken();
      switch (currentToken.type) {
        case TokenType.EOF:
          throw this.error('Encounter unclosed block when consuming Function Node');
        case TokenType.RIGHT_PARENTHESIS:
          funcNode.source.to = this.currentToken().start;
          this.step();
          return funcNode;
        case TokenType.FUNCTION:
          const childNode = this.consumeFunction();
          funcNode.value.push(childNode);
          break;
        case TokenType.COMMENT:
        case TokenType.WHITESPACE:
          this.step();
          break;
        default:
          this.step();
          funcNode.value.push(currentToken);
      }
    }
  }

  /**
   * consume a qualified rule
   */
  private consumeQualifiedRule(tokens: Token[]) {
    if (tokens.length === 0) {
      throw this.error('No selector exists in a qualified rule');
    }
    const rule = new QualifiedRule();
    rule.prelude = tokens;
    rule.source.from = tokens[0].start - tokens[0].raw.length;
    while (true) {
      this.allowWhiteSpace();
      const currentToken = this.currentToken();
      if (currentToken.type === TokenType.EOF) {
        throw this.error('Encountering unclosed block when consuming a qualified rule');
      }
      if (currentToken.type === TokenType.RIGHT_CURLY_BRACKET) {
        rule.source.to = this.currentToken().start;
        this.step();
        return rule;
      }
      rule.addChild(this.other());
    }
  }
}
