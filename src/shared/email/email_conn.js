const BrowserBox = require('browserbox');
const SmtpClient = require('wo-smtpclient');
const MimeParser = require('mimeparser');
const semaphore = require('semaphore');

module.exports = EmailConnection;

function EmailConnection() {
	var imap;
	var imapLock = semaphore(1);
	var sender;
	var password;
	var smtpHost;
	var smtpPort;
	var selectedFolder;
	return {
		login: function(arg, success, error) {
			imapLock.take(function() {
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
					imapLock.leave();
					success();
				};
				imap.onerror = function(err) {
					imapLock.leave();
					error(err);
				}
				imap.connect();
			});
		},
		getFolders: function(success, error) {
			imapLock.take(function() {
				imap.listMailboxes(function(err, mailboxes) {
					imapLock.leave();
					if (err !== undefined && err !== null) {
						error(err);
					}
					else {
						success(mailboxes);
					}
				});
			});
		},
		getEmailsAfterUid: function(path, uid, success, error) {
			getEmails(path, { byUid: true, lastUid: uid + 1 }, function(emails){
				success(emails.filter(function(email) { 
					return email.uid > uid; 
				}));
			}, error);
		},
		getEmails: function(path, offset, count, success, error){
			getEmails(path, { byUid: false, offset: offset, count: count }, success, error);
		},
		getEmailBody: function(uid, path, success, error) {
			path = path || 'Inbox';
			imapLock.take(function() {
				if (selectedFolder != path) {
					imap.selectMailbox(path, function(err, mailbox){
						if (err !== undefined && err !== null) {
							imapLock.leave();
							error(err);
						}
						else {
							selectedFolder = path;
							getEmailBody();
						}
					});
				} else {
					getEmailBody();
				}
				
				function getEmailBody() {
					imap.listMessages(uid + ':' + uid, ['body[]'], { byUid: true }, function(err, messages) {
						imapLock.leave();
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
					to: arg.to
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
		},
		close() {
			imap.close();
		},
		getAccount() {
			return sender;
		}
	}
	
	function getEmails(path, args, success, error) {
		path = path || 'Inbox';
		imapLock.take(function() {
			imap.selectMailbox(path, function(err, mailbox){
				if (err !== undefined && err !== null) {
					imapLock.leave();
					error(err);
				}
				else {
					selectedFolder = path;
					if (mailbox.exists <= 0) {
						imapLock.leave();
						success([]);
					}
					else {
						var sequence;
						var options = {};
						if (args.byUid) {
							sequence = args.lastUid + ':*';
							options.byUid = true;
						} else {
							var pageStart = Math.max(1, mailbox.exists - args.offset - args.count + 1);
							var pageEnd = Math.max(1, mailbox.exists - args.offset);
							sequence = pageStart + ':' + pageEnd;
						}
						imap.listMessages(sequence, ['uid', 'flags', 'envelope'], options, function(err, messages){
							imapLock.leave();
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
				}
			});
		});
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