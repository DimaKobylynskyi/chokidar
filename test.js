'use strict';

var chai, chokidar, delay, expect, fixturesPath, fs, getFixturePath, isBinary, should, sinon, sysPath;

chai = require('chai');

expect = chai.expect;

should = chai.should();

sinon = require('sinon');

chai.use(require('sinon-chai'));

chokidar = require('./');

fs = require('fs');

sysPath = require('path');

getFixturePath = function(subPath) {
  return sysPath.join(__dirname, 'test-fixtures', subPath);
};

fixturesPath = getFixturePath('');

delay = function(fn) {
  return setTimeout(fn, 250);
};

describe('chokidar', function() {
  it('should expose public API methods', function() {
    chokidar.FSWatcher.should.be.a('function');
    chokidar.watch.should.be.a('function');
  });

  describe('polling', runTests.bind(this, {usePolling: true}));
  describe('non-polling', runTests.bind(this, {usePolling: false, useFsEvents: false}));
  describe('fsevents', runTests.bind(this, {useFsEvents: true}));
});

function runTests (options) {
  if (!options) options = {};

  describe('close', function() {
    before(function() {
      try {
        fs.unlinkSync(getFixturePath('add.txt'));
      } catch(err) {}
    });

    after(function() {
      this.watcher.close();
      try {
        fs.unlinkSync(getFixturePath('add.txt'));
      } catch(err) {}
    });

    it('should ignore further events on close', function(done) {
      this.watcher = chokidar.watch(fixturesPath, options);

      var watcher = this.watcher;
      var spy = sinon.spy();
      watcher.once('add', function() {
        watcher.once('add', function() {
          watcher.close();
          delay(function() {
            watcher.on('add', spy);
            fs.writeFileSync(getFixturePath('add.txt'), 'hello world');
            delay(function() {
              spy.should.not.have.been.called;
              done();
            });
          });
        });
      });

      fs.writeFileSync(getFixturePath('add.txt'), 'hello world');
      fs.unlinkSync(getFixturePath('add.txt'));
    });
  });

  describe('watch', function() {
    beforeEach(function(done) {
      this.watcher = chokidar.watch(fixturesPath, options);
      delay(done);
    });
    afterEach(function(done) {
      this.watcher.close();
      delete this.watcher;
      delay(done);
    });
    before(function(done) {
      try {
        fs.unlinkSync(getFixturePath('add.txt'));
      } catch (_error) {}
      try {
        fs.unlinkSync(getFixturePath('subdir/add.txt'));
      } catch (_error) {}
      try {
        fs.rmdirSync(getFixturePath('subdir'));
      } catch (_error) {}
      fs.writeFileSync(getFixturePath('change.txt'), 'b');
      fs.writeFileSync(getFixturePath('unlink.txt'), 'b');
      delay(done);
    });
    after(function() {
      try {
        fs.unlinkSync(getFixturePath('add.txt'));
      } catch (_error) {}
      fs.writeFileSync(getFixturePath('change.txt'), 'a');
      fs.writeFileSync(getFixturePath('unlink.txt'), 'a');
    });
    it('should produce an instance of chokidar.FSWatcher', function() {
      this.watcher.should.be.an["instanceof"](chokidar.FSWatcher);
    });
    it('should expose public API methods', function() {
      this.watcher.on.should.be.a('function');
      this.watcher.emit.should.be.a('function');
      this.watcher.add.should.be.a('function');
      this.watcher.close.should.be.a('function');
    });
    it('should emit `add` event when file was added', function(done) {
      var spy, testPath,
        _this = this;
      spy = sinon.spy();
      testPath = getFixturePath('add.txt');
      this.watcher.on('add', spy);
      delay(function() {
        spy.should.not.have.been.called;
        fs.writeFileSync(testPath, 'hello');
        delay(function() {
          spy.should.have.been.calledOnce;
          spy.should.have.been.calledWith(testPath);
          done();
        });
      });
    });

    it('should emit `addDir` event when directory was added', function(done) {
      var spy, testDir,
        _this = this;
      spy = sinon.spy();
      testDir = getFixturePath('subdir');
      this.watcher.on('addDir', spy);
      delay(function() {
        spy.should.not.have.been.called;
        fs.mkdirSync(testDir, 0x1ed);
        delay(function() {
          spy.should.have.been.calledOnce;
          spy.should.have.been.calledWith(testDir);
          done();
        });
      });
    });
    it('should emit `change` event when file was changed', function(done) {
      var spy, testPath,
        _this = this;
      spy = sinon.spy();
      testPath = getFixturePath('change.txt');
      this.watcher.on('change', spy);
      delay(function() {
        spy.should.not.have.been.called;
        fs.writeFileSync(testPath, 'c');
        delay(function() {
          spy.should.have.been.calledOnce;
          spy.should.have.been.calledWith(testPath);
          done();
        });
      });
    });
    it('should emit `unlink` event when file was removed', function(done) {
      var spy, testPath,
        _this = this;
      spy = sinon.spy();
      testPath = getFixturePath('unlink.txt');
      this.watcher.on('unlink', spy);
      delay(function() {
        spy.should.not.have.been.called;
        fs.unlinkSync(testPath);
        delay(function() {
          spy.should.have.been.calledOnce;
          spy.should.have.been.calledWith(testPath);
          done();
        });
      });
    });
    it('should emit `unlinkDir` event when a directory was removed', function(done) {
      var spy, testDir,
        _this = this;
      spy = sinon.spy();
      testDir = getFixturePath('subdir');
      this.watcher.on('unlinkDir', spy);
      delay(function() {
        fs.rmdirSync(testDir);
        delay(function() {
          spy.should.have.been.calledOnce;
          spy.should.have.been.calledWith(testDir);
          done();
        });
      });
    });
    it('should survive ENOENT for missing subdirectories', function() {
      var testDir;
      testDir = getFixturePath('subdir');
      this.watcher.add(testDir);
    });
    it('should notice when a file appears in a new directory', function(done) {
      var spy, testDir, testPath,
        _this = this;
      spy = sinon.spy();
      testDir = getFixturePath('subdir');
      testPath = getFixturePath('subdir/add.txt');
      this.watcher.on('add', spy);
      this.watcher.add(testDir);
      delay(function() {
        spy.should.not.have.been.callled;
        fs.mkdirSync(testDir, 0x1ed);
        fs.writeFileSync(testPath, 'hello');
        delay(function() {
          spy.should.have.been.calledOnce;
          spy.should.have.been.calledWith(testPath);
          done();
        });
      });
    });
  });
  describe('watch options', function() {
    function clean (done) {
      try {
        fs.unlinkSync(getFixturePath('subdir/add.txt'));
      } catch (_error) {}
      try {
        fs.unlinkSync(getFixturePath('subdir/dir/ignored.txt'));
      } catch (_error) {}
      try {
        fs.rmdirSync(getFixturePath('subdir/dir'));
      } catch (_error) {}
      try {
        fs.rmdirSync(getFixturePath('subdir'));
      } catch (_error) {}
      delay(done);
    }
    beforeEach(clean);
    after(clean);
    describe('ignoreInitial', function() {
      before(function() {
        options.ignoreInitial = true;
      });
      after(function() {
        delete options.ignoreInitial;
      });
      it('should ignore inital add events', function(done) {
        var spy, watcher,
          _this = this;
        spy = sinon.spy();
        watcher = chokidar.watch(fixturesPath, options);
        watcher.on('add', spy);
        delay(function() {
          spy.should.not.have.been.called;
          watcher.close();
          done();
        });
      });
      it('should notice when a file appears in an empty directory', function(done) {
        var spy, testDir, testPath, watcher,
          _this = this;
        spy = sinon.spy();
        testDir = getFixturePath('subdir');
        testPath = getFixturePath('subdir/add.txt');
        watcher = chokidar.watch(fixturesPath, options);
        watcher.on('add', spy);
        delay(function() {
          spy.should.not.have.been.called;
          fs.mkdirSync(testDir, 0x1ed);
          watcher.add(testDir);
          fs.writeFileSync(testPath, 'hello');
          delay(function() {
            spy.should.have.been.calledOnce;
            spy.should.have.been.calledWith(testPath);
            done();
          });
        });
      });
    });

    describe('ignored', function() {
      after(function() {
        delete options.ignored;
      });
      it('should check ignore after stating', function(done) {
        var ignoredFn, spy, testDir, watcher,
          _this = this;
        testDir = getFixturePath('subdir');
        spy = sinon.spy();
        ignoredFn = function(path, stats) {
          if (path === testDir || !stats) {
            return false;
          }
          return stats.isDirectory();
        };
        options.ignored = ignoredFn;
        watcher = chokidar.watch(testDir, options);
        watcher.on('add', spy);
        try {
          fs.mkdirSync(testDir, 0x1ed);
        } catch (_error) {}
        fs.writeFileSync(testDir + '/add.txt', '');
        fs.mkdirSync(testDir + '/dir', 0x1ed);
        fs.writeFileSync(testDir + '/dir/ignored.txt', '');
        delay(function() {
          spy.should.have.been.calledOnce;
          spy.should.have.been.calledWith(sysPath.join(testDir, 'add.txt'));
          done();
        });
      });
    });
  });
}

describe('is-binary', function() {
  var isBinary = chokidar.isBinaryPath;
  it('should be a function', function() {
    isBinary.should.be.a('function');
  });
  it('should correctly determine binary files', function() {
    isBinary('a.jpg').should.equal(true);
    isBinary('a.jpeg').should.equal(true);
    isBinary('a.zip').should.equal(true);
    isBinary('ajpg').should.equal(false);
    isBinary('a.txt').should.equal(false);
  });
});