pipeline {
    agent any

    environment {
        // Docker Hub variables (use Jenkins credentials for security)
        DOCKER_HUB_ORG = 'brinkops'
        DOCKER_HUB_FRONT_IMAGE = "${DOCKER_HUB_ORG}/aer-py-front-${env.GIT_BRANCH}"
        DOCKER_HUB_BACK_IMAGE = "${DOCKER_HUB_ORG}/aer-py-back-${env.GIT_BRANCH}"

        // AWS ECR/EKS related variables
        AWS_REGION = 'us-east-2' // User specified region
        EKS_CLUSTER_NAME = 'jb-cluster' // User specified cluster name

        // Define GitHub repository names for clarity during checkout
        FRONTEND_GITHUB_REPO = 'aer-py-front'
        BACKEND_GITHUB_REPO = 'aer-py-back'

        // Kubernetes namespace
        K8S_NAMESPACE = 'production'

        // Git Branch variable
        GIT_BRANCH = 'main' // <--- Set the git branch here (e.g., 'main', 'dev')
    }

    stages {
        stage('Checkout Source Code') {
            steps {
                echo "Cloning frontend repository https://github.com/brink-ops/${env.FRONTEND_GITHUB_REPO}.git"
                dir("${env.FRONTEND_GITHUB_REPO}") {
                    git branch: env.GIT_BRANCH, url: "https://github.com/brink-ops/${env.FRONTEND_GITHUB_REPO}.git" 
                    sh 'echo "--- Frontend Repo Contents ---"; ls -R; echo "-----------------------------"'
                }

                echo "Cloning backend repository https://github.com/brink-ops/${env.BACKEND_GITHUB_REPO}.git"
                dir("${env.BACKEND_GITHUB_REPO}") {
                    git branch: env.GIT_BRANCH, url: "https://github.com/brink-ops/${env.BACKEND_GITHUB_REPO}.git" 
                    sh 'echo "--- Backend Repo Contents ---"; ls -R; echo "-----------------------------"'
                }
            }
        }

        stage('Create Dockerfiles') {
            steps {
                script {
                    echo "Creating Dockerfiles for front end and back end in their respective directories..."

                    dir("${env.FRONTEND_GITHUB_REPO}") {
                        writeFile file: 'Dockerfile', text: """
                            FROM nginx:latest
                            WORKDIR /usr/share/nginx/html
                            COPY index.html .
                            COPY script.js .
                            COPY style.css .
                            COPY nginx.conf /etc/nginx/nginx.conf
                            EXPOSE 80
                            CMD ["/bin/sh", "-c", "nginx -g 'daemon off;'"]
                        """
                        sh 'echo "--- Frontend Dockerfile Content ---"; cat Dockerfile; echo "-----------------------------------"'
                    }

                    dir("${env.BACKEND_GITHUB_REPO}") {
                        writeFile file: 'Dockerfile', text: """
                            FROM python:3.9-slim-buster
                            WORKDIR /app/backend
                            COPY requirements.txt .
                            RUN pip install -r requirements.txt
                            COPY app.py .
                            EXPOSE 5000
                            CMD ["python", "app.py"]
                        """
                        sh 'echo "--- Backend Dockerfile Content ---"; cat Dockerfile; echo "----------------------------------"'
                    }
                }
            }
        }

        stage('Build and Push Docker Images') {
            steps {
                script {
                    def full_tag = "${env.BUILD_NUMBER}-${env.GIT_BRANCH}" 
                    echo "Logging into Docker Hub..."
                    withCredentials([usernamePassword(credentialsId: '9344fb93-8694-4200-9a89-7e614533f02f', passwordVariable: 'DOCKER_PASSWORD', usernameVariable: 'DOCKER_USERNAME')]) {
                        sh "echo \$DOCKER_PASSWORD | docker login -u \$DOCKER_USERNAME --password-stdin"
                    }
                    dir("${env.FRONTEND_GITHUB_REPO}") {
                        echo "Building and pushing frontend image: ${DOCKER_HUB_FRONT_IMAGE}:${full_tag}"
                        sh "docker build -t ${DOCKER_HUB_FRONT_IMAGE}:${full_tag} ." // Build context is current directory
                        sh "docker push ${DOCKER_HUB_FRONT_IMAGE}:${full_tag}"

                        // Tag and push 'latest' for convenience
                        sh "docker tag ${DOCKER_HUB_FRONT_IMAGE}:${full_tag} ${DOCKER_HUB_FRONT_IMAGE}:latest"
                        sh "docker push ${DOCKER_HUB_FRONT_IMAGE}:latest"
                    }

                    // Build and push Backend Docker image from its repo directory
                    dir("${env.BACKEND_GITHUB_REPO}") {
                        echo "Building and pushing backend image: ${DOCKER_HUB_BACK_IMAGE}:${full_tag}"
                        sh "docker build -t ${DOCKER_HUB_BACK_IMAGE}:${full_tag} ." // Build context is current directory
                        sh "docker push ${DOCKER_HUB_BACK_IMAGE}:${full_tag}"

                        // Tag and push 'latest' for convenience
                        sh "docker tag ${DOCKER_HUB_BACK_IMAGE}:${full_tag} ${DOCKER_HUB_BACK_IMAGE}:latest"
                        sh "docker push ${DOCKER_HUB_BACK_IMAGE}:latest"
                    }

                    echo "Docker images pushed successfully!"
                }
            }
        }

        stage('Deploy to EKS') {
            steps {
                script {
                    def image_tag_for_eks = "${env.BUILD_NUMBER}-${env.GIT_BRANCH}" 

                    echo "Updating Kubeconfig for EKS cluster: ${EKS_CLUSTER_NAME}"
                    sh "aws eks update-kubeconfig --name ${EKS_CLUSTER_NAME} --region ${AWS_REGION}"

                    echo "Ensuring 'production' namespace exists in EKS cluster..."
                    sh "kubectl create namespace ${env.K8S_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -"

                    def frontend_deployment_yaml = """
                        apiVersion: apps/v1
                        kind: Deployment
                        metadata:
                          name: py-test-front
                        spec:
                          replicas: 2
                          selector:
                            matchLabels:
                              app: py-test-front
                          template:
                            metadata:
                              labels:
                                app: py-test-front
                            spec:
                              containers:
                              - name: py-test-front
                                image: ${DOCKER_HUB_FRONT_IMAGE}:${image_tag_for_eks} 
                                ports:
                                - containerPort: 80
                    """

                    def frontend_service_yaml = """
                        apiVersion: v1
                        kind: Service
                        metadata:
                          name: py-test-front-service
                        spec:
                          selector:
                            app: py-test-front
                          ports:
                            - protocol: TCP
                              port: 80
                              targetPort: 80
                          type: LoadBalancer
                    """

                    def backend_deployment_yaml = """
                        apiVersion: apps/v1
                        kind: Deployment
                        metadata:
                          name: py-test-back
                        spec:
                          replicas: 2
                          selector:
                            matchLabels:
                              app: py-test-back
                          template:
                            metadata:
                              labels:
                                app: py-test-back
                            spec:
                              containers:
                              - name: py-test-back
                                image: ${DOCKER_HUB_BACK_IMAGE}:${image_tag_for_eks}
                                ports:
                                - containerPort: 5000
                    """

                    def backend_service_yaml = """
                        apiVersion: v1
                        kind: Service
                        metadata:
                          name: py-test-back-service
                        spec:
                          selector:
                            app: py-test-back
                          ports:
                            - protocol: TCP
                              port: 5000
                              targetPort: 5000
                          type: ClusterIP
                    """

                    echo "Applying frontend deployment and service to ${env.K8S_NAMESPACE} namespace..."
                    sh """cat <<EOF | kubectl apply --namespace=${env.K8S_NAMESPACE} -f -${frontend_deployment_yaml} 
                    EOF
                    """
                    sh """cat <<EOF | kubectl apply --namespace=${env.K8S_NAMESPACE} -f -${frontend_service_yaml}
                    EOF
                    """

                    echo "Applying backend deployment and service to ${env.K8S_NAMESPACE} namespace..."
                    sh """cat <<EOF | kubectl apply --namespace=${env.K8S_NAMESPACE} -f - ${backend_deployment_yaml}
                    EOF
                    """
                    sh """cat <<EOF | kubectl apply --namespace=${env.K8S_NAMESPACE} -f - ${backend_service_yaml}
                    EOF
                    """

                    echo "Deployment to EKS cluster complete!"
                }
            }
        }
    }

    post {
        always {
            cleanWs()
            echo 'Pipeline finished.'
        }
        success {
            echo "Deployment successful!"
        }
        failure {
            echo 'Pipeline failed. Check logs for details.'
        }
    }
}
