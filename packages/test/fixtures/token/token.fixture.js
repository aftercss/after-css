const BaseFixture = require('after-test').BaseFixture;
const CSSTokenizer = require('@aftercss/tokenizer');

const path = require('path');

class TokenFixture extends BaseFixture {
  async build() {
    const content = await this.readFile('src', 'index.css');
    const tokenizer = new CSSTokenizer(content);
    tokenizer.preprocess();
    const token = tokenizer.nextToken();
    return token.toString();
  }
}

const tokenFixture = new TokenFixture(path.resolve(__dirname, './unicoderange-token'));

tokenFixture.runTask('Tokenizer', 'unicoderange.json');
