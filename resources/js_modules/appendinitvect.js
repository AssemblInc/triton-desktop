/* from https://gist.githubusercontent.com/bbstilson/e2617cf1375481a34c0b6d9ecf0879bf/raw/3f16210ec2ee04c3acd8d92b36dd00f7d170f619/appendInitVect.js */

const { Transform } = require('stream');

class AppendInitVect extends Transform {
  constructor(initVect, opts) {
    super(opts);
    this.initVect = initVect;
    this.appended = false;
  }

  _transform(chunk, encoding, cb) {
    if (!this.appended) {
      this.push(this.initVect);
      this.appended = true;
    }
    this.push(chunk);
    cb();
  }
}

module.exports = AppendInitVect;