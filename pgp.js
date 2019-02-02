const kbpgp = require('kbpgp');

var PGP = kbpgp["const"].openpgp;

var opts = {
  userid: "name entered in app" + " " + "<random.string@app-users.assembl.science>",
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

kbpgp.KeyManager.generate(opts, function(err, alice) {
  if (!err) {
    // sign alice's subkeys
    alice.sign({}, function(err) {
		console.log(alice);
		// export demo; dump the private with a passphrase
		alice.export_pgp_private ({
		passphrase: ''
		}, function(err, pgp_private) {
		console.log("private key: ", pgp_private);
		});
		alice.export_pgp_public({}, function(err, pgp_public) {
		console.log("public key: ", pgp_public);
		});
    });
  }
});