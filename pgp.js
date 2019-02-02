const kbpgp = require('kbpgp');

var PGP = kbpgp["const"].openpgp;

var opts = {
  userid: "name entered in app" + " " + "<todo-user-id@users.assembl.science>",
  primary: {
    nbits: 4096,
    flags: PGP.certify_keys | PGP.sign_data | PGP.auth | PGP.encrypt_comm | PGP.encrypt_storage,
    expire_in: 86400 * 42  // 42 days
  },
  subkeys: [
    {
      nbits: 2048,
      flags: PGP.sign_data,
      expire_in: 86400 * 21 // 21 days
    }, {
      nbits: 2048,
      flags: PGP.encrypt_storage,
      expire_in: 86400 * 21
    }
  ]
};

kbpgp.KeyManager.generate(opts, function(err, sender) {
  if (!err) {
    // sign sender's subkeys
    sender.sign({}, function(err) {
		console.log(sender);
    // export demo; dump the private with a passphrase
    /*
		sender.export_pgp_private ({
		passphrase: ''
		}, function(err, pgp_private) {
		console.log("private key: ", pgp_private);
    });
    */
		sender.export_pgp_public({}, function(err, pgp_public) {
		console.log("public key: ", pgp_public);
		});
    });
  }
});

//var fileobject = node_file_object;
//var reader = new FileReader();   // modern browsers have this
//reader.readAsBinaryString(fileobject);
//reader.onloadend = function(file) {
//  var buffer = new kbpgp.Buffer(r.result);
  // ... now process it using kbpgp
//};