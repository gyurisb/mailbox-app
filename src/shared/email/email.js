const BrowserBox = require('browserbox');
const SmtpClient = require('wo-smtpclient');
const MimeParser = require('mimeparser');

module.exports = newEmailConnection;

function newEmailConnection() {
	var imap;
	var sender;
	var password;
	var smtpHost;
	var smtpPort;
	return {
		login: function(arg, success, error) {
			imap = new BrowserBox(arg.imapHost, arg.imapPort, {
				auth: {
					user: arg.username,
					pass: arg.password
				},
				id: {
					name: 'My Client',
					version: '0.1'
				}
			});
			imap.onauth = function() {
				sender = arg.username;
				password = arg.password;
				smtpHost = arg.smtpHost;
				smtpPort = arg.smtpPort;
				success();
			};
			imap.onerror = function(err) {
				error(err);
			}
			imap.connect();
		},
		getFolders: function(success, error) {
			imap.listMailboxes(function(err, mailboxes) {
				if (err !== undefined && err !== null) {
					error(err);
				}
				else {
					success(mailboxes);
				}
			});
		},
		getEmails: function(path, success, error){
			imap.selectMailbox(path || 'INBOX', function(err, mailbox){
				if (mailbox.exists <= 0) {
					success([]);
				}
				else {
					var pageStart = Math.max(1, mailbox.exists - 8);
					imap.listMessages(pageStart + ':*', ['uid', 'flags', 'envelope'], function(err, messages){
						if (err !== undefined && err !== null) {
							error(err);
						}
						else {
							messages.sort(function(a, b){
								return new Date(b.envelope.date).valueOf() - new Date(a.envelope.date).valueOf();
							});
							success(messages);
						}
					});
				}
			});
		},
		getEmailBody: function(uid, success, error) {
			imap.listMessages(uid + ':' + uid, ['body[]'], { byUid: true }, function(err, messages) {
				if (err !== undefined && err !== null) {
					error(err);
				}
				else {
					var body = messages[0]['body[]'];
					var parser = new MimeParser();
					var node;
					var parts = [];
					parser.onheader = function(node_) {
						node = node_;
					};
					parser.onbody = function(node, chunk){
						parts.push({
							contentType: node.headers['content-type'][0].value,
							charset: node.charset,
							chunk: chunk
						});
					};
					parser.onend = function(){
						var part = null;
						part = first(parts, function(e){ return e.contentType == "text/html" && e.charset == "utf-8"; });
						if (part == null)
							part = first(parts, function(e){ return e.contentType == "text/plain" && e.charset == "utf-8"; });
						var text = "";
						if (part != null)
							 text = uintToString(part.chunk);
						success({ text: text, type: part.contentType });
					};
					parser.write(body);
					parser.end();
				}
			});
		},
		sendEmail: function(arg, success, error) {
			var alreadySending = false;
			var client = new SmtpClient(smtpHost, smtpPort, {
				//useSecureTransport: true,
				name: sender,
				auth: {
					user: sender,
					pass: password
				}
			});
			client.onidle = function(){
				if(alreadySending){
					return;
				}
				alreadySending = true;
				client.useEnvelope({
					from: sender,
					to: [arg.to]
				});
			};
			client.onready = function(failedRecipients){
				if(failedRecipients.length){
					error("The following addresses were rejected: " + failedRecipients.join());
				}
				else {
					client.send("Subject: " + arg.subject + "\r\n");
					client.send("\r\n");
					client.send(arg.body);
					client.end();
					success();
				}
			};
			client.onerror = function(err) {
				error(err);
			};
			client.connect();
		}
	}
}

function uintToString(uintArray) {
    var encodedString = String.fromCharCode.apply(null, uintArray),
        decodedString = decodeURIComponent(escape(encodedString));
    return decodedString;
}
function first(array, func) {
    for (var i = 0; i < array.length; i++) {
       if (func(array[i]))
            return array[i]; 
    };
    return null;
}